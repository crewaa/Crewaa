"""
Refresh tokens (V2 §2.3).

Before this existed, `REFRESH_TOKEN_EXPIRE_DAYS` was read and never used and
`/auth/logout` deleted a cookie nothing ever set. When an access token expired
the user was simply bounced to `/login` — which, now that the product carries
messaging, offers, delivery and reviews, means being thrown out mid-negotiation.

Most of what follows is not about the happy path. Every token Crewaa issues is
signed with the same secret, so the dangerous failures here are all variations
on "one kind of token was accepted where another was meant", and each of those
would be invisible in normal use while quietly extending a session far beyond
its intended life.
"""

from datetime import datetime, timedelta

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE, create_access_token,
    create_refresh_token,
)
from tests.conftest import make_user

COOKIE = "refresh_token"
PASSWORD = "correct-horse-battery"


async def _login(client, email: str = "creator@example.com", password: str = PASSWORD):
    return await client.post("/auth/login", json={"email": email, "password": password})


# ---------------------------------------------------------------------------
# The happy path
# ---------------------------------------------------------------------------

async def test_logging_in_sets_a_refresh_cookie(client, session_factory):
    await make_user(session_factory, "creator@example.com", "INFLUENCER")

    res = await _login(client)

    assert res.status_code == 200
    assert COOKIE in res.cookies
    claims = jwt.decode(
        res.cookies[COOKIE], settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    assert claims["type"] == REFRESH_TOKEN_TYPE


async def test_refresh_returns_a_working_access_token(client, session_factory):
    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await _login(client)

    res = await client.post("/auth/refresh")
    assert res.status_code == 200

    token = res.json()["access_token"]
    claims = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    assert claims["type"] == ACCESS_TOKEN_TYPE
    assert claims["sub"] == str(user.id)

    # And it actually authenticates — the point of the whole feature.
    me = await client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200


async def test_the_refresh_token_is_rotated_on_use(client, session_factory):
    """
    A refresh token that never changes is one long-lived credential crossing the
    network repeatedly. Rotating means a copy captured once stops working as
    soon as the real client refreshes again.
    """
    await make_user(session_factory, "creator@example.com", "INFLUENCER")
    first = (await _login(client)).cookies[COOKIE]

    res = await client.post("/auth/refresh")

    assert res.cookies[COOKIE] != first


# ---------------------------------------------------------------------------
# Token confusion — the failures that would not look like failures
# ---------------------------------------------------------------------------

async def test_a_refresh_token_cannot_authenticate_a_request(client, session_factory):
    """
    The one that matters most.

    A refresh token lives for REFRESH_TOKEN_EXPIRE_DAYS and is handed to the
    browser. If `get_current_user` accepted it, the short access-token lifetime
    would protect nothing at all — and nothing in ordinary use would reveal it,
    because the valid signature makes it look like any other token.
    """
    await make_user(session_factory, "creator@example.com", "INFLUENCER")
    refresh = (await _login(client)).cookies[COOKIE]

    res = await client.get("/users/me", headers={"Authorization": f"Bearer {refresh}"})

    assert res.status_code == 401


async def test_an_access_token_cannot_be_redeemed_for_another_one(client, session_factory):
    """
    The mirror image: if /auth/refresh accepted an access token, a token stolen
    out of localStorage would renew itself indefinitely.
    """
    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    access = create_access_token({"sub": str(user.id), "role": user.role}, 60)

    client.cookies.clear()
    client.cookies.set(COOKIE, access)
    res = await client.post("/auth/refresh")
    client.cookies.clear()

    assert res.status_code == 401


async def test_a_token_with_no_type_claim_is_rejected(client, session_factory):
    """
    Fail closed. A hand-rolled token carrying only `sub` is correctly signed and
    would once have passed; the check is for `== "access"`, not `!= "refresh"`,
    so the next token kind added to this codebase is rejected by default rather
    than by having been remembered.
    """
    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    forged = jwt.encode(
        {"sub": str(user.id), "role": user.role,
         "exp": datetime.utcnow() + timedelta(minutes=30)},
        settings.jwt_secret_key, algorithm=settings.jwt_algorithm,
    )

    res = await client.get("/users/me", headers={"Authorization": f"Bearer {forged}"})

    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Revocation — what makes logout mean anything
# ---------------------------------------------------------------------------

async def test_logout_kills_a_refresh_token_already_copied_elsewhere(
    client, session_factory
):
    """
    The scenario logout exists for: someone signs in on a shared machine, their
    cookie is copied, they sign out. Clearing their own cookie does nothing to
    the copy. Bumping the account's token version does.
    """
    await make_user(session_factory, "creator@example.com", "INFLUENCER")
    stolen = (await _login(client)).cookies[COOKIE]

    await client.post("/auth/logout")

    client.cookies.clear()
    client.cookies.set(COOKIE, stolen)
    res = await client.post("/auth/refresh")
    client.cookies.clear()

    assert res.status_code == 401


async def test_logout_is_not_an_error_when_there_is_nothing_to_log_out_of(client):
    """
    Someone ending a session that already ended has nothing to do differently,
    so answering with an error would only be noise in the UI.
    """
    res = await client.post("/auth/logout")
    assert res.status_code == 204


async def test_setting_a_password_ends_earlier_sessions(client, session_factory):
    """
    An account that had no password has nothing securing it. Any session opened
    before one existed must not survive the moment one is set.
    """
    from app.modules.auth.service import create_setup_token

    user = await make_user(
        session_factory, "google@example.com", "INFLUENCER", password=None
    )
    old = create_refresh_token(user.id, user.token_version, 7)

    res = await client.post(
        "/auth/set-password",
        json={"setup_token": create_setup_token("google@example.com", "INFLUENCER"),
              "password": "a-brand-new-password"},
    )
    assert res.status_code == 200

    # Clear first: /auth/set-password just planted a *valid* cookie, and
    # without this the client would send that one instead of the stale token
    # under test.
    client.cookies.clear()
    client.cookies.set(COOKIE, old)
    stale = await client.post("/auth/refresh")
    client.cookies.clear()

    assert stale.status_code == 401


async def test_a_disabled_account_cannot_refresh(client, session_factory):
    """
    Checked on refresh, not only at login. A token issued days ago must stop
    working the moment an admin disables the account, rather than renewing
    happily until it expires on its own.
    """
    from sqlalchemy import select

    from app.modules.users.models import User

    await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await _login(client)

    async with session_factory() as db:
        user = (await db.execute(select(User))).scalar()
        user.is_active = False
        await db.commit()

    res = await client.post("/auth/refresh")

    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Shape and hygiene
# ---------------------------------------------------------------------------

async def test_refresh_without_a_cookie_is_rejected(client):
    assert (await client.post("/auth/refresh")).status_code == 401


async def test_a_refresh_token_carries_no_role(client, session_factory):
    """
    A refresh token outlives any single session. A role baked into it would keep
    asserting whatever the user was when they signed in, so an admin demoted to
    brand would carry admin in their pocket until it expired.
    """
    await make_user(session_factory, "admin@example.com", "ADMIN")
    res = await _login(client, "admin@example.com")

    claims = jwt.decode(
        res.cookies[COOKIE], settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )

    assert "role" not in claims


async def test_the_cookie_is_http_only(client, session_factory):
    """
    httpOnly is the whole reason this is a cookie and not another localStorage
    entry: the access token there is already script-readable, but it dies in
    minutes. A script-readable refresh token would turn one XSS bug into weeks
    of access.
    """
    await make_user(session_factory, "creator@example.com", "INFLUENCER")

    res = await _login(client)

    header = res.headers["set-cookie"].lower()
    assert "httponly" in header


async def test_an_expired_refresh_token_is_rejected(client, session_factory):
    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    expired = jwt.encode(
        {"sub": str(user.id), "ver": user.token_version, "type": REFRESH_TOKEN_TYPE,
         "exp": datetime.utcnow() - timedelta(seconds=1)},
        settings.jwt_secret_key, algorithm=settings.jwt_algorithm,
    )

    client.cookies.clear()
    client.cookies.set(COOKIE, expired)
    res = await client.post("/auth/refresh")
    client.cookies.clear()

    assert res.status_code == 401


@pytest.mark.parametrize("bad", ["", "not-a-jwt", "a.b.c"])
async def test_a_malformed_cookie_is_rejected_not_crashed(client, bad):
    client.cookies.clear()
    client.cookies.set(COOKIE, bad)
    res = await client.post("/auth/refresh")
    client.cookies.clear()

    assert res.status_code == 401


async def test_every_refresh_failure_reads_the_same(client, session_factory):
    """
    Expired, revoked and absent all answer identically. Distinguishing them
    tells whoever holds a stolen token which case it is, and the legitimate user
    does the same thing — sign in again — in all three.
    """
    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    revoked = create_refresh_token(user.id, user.token_version + 5, 7)
    expired = jwt.encode(
        {"sub": str(user.id), "ver": user.token_version, "type": REFRESH_TOKEN_TYPE,
         "exp": datetime.utcnow() - timedelta(seconds=1)},
        settings.jwt_secret_key, algorithm=settings.jwt_algorithm,
    )

    details = set()
    for token in (revoked, expired, None):
        client.cookies.clear()
        if token:
            client.cookies.set(COOKIE, token)
        details.add((await client.post("/auth/refresh")).json()["detail"])
    client.cookies.clear()

    assert len(details) == 1, f"refresh failures are distinguishable: {details}"
