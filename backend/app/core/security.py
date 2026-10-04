from datetime import datetime, timedelta
from uuid import uuid4

from jose import jwt
from passlib.context import CryptContext
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

# `bcrypt__rounds` is configurable because the cost is a real product decision,
# not just a security one: each round doubles the work, and on a small shared
# instance the difference between 12 and 10 is the difference between a login
# that feels instant and one that does not. Existing hashes keep working when it
# changes — bcrypt stores the cost it was created with inside the hash itself.
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.bcrypt_rounds,
)

# Purpose claim carried by the short-lived token issued during Google sign-up,
# used ONLY to authorise POST /auth/set-password. Defined here (rather than in
# the auth module) so that app/common/dependencies.py can reject such tokens
# without importing the auth service and creating a circular import.
SETUP_TOKEN_PURPOSE = "set_password"

# Minimum password length enforced at signup / set-password.
MIN_PASSWORD_LENGTH = 8


def hash_password(password: str) -> str:
    """Synchronous. Safe from scripts and tests; never call it from a handler."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Synchronous. Safe from scripts and tests; never call it from a handler."""
    return pwd_context.verify(password, hashed)


# ---------------------------------------------------------------------------
# Async wrappers — the only forms a request handler may use.
#
# bcrypt is deliberately slow and deliberately CPU-bound: ~180ms per call on a
# developer laptop, several times that on a small shared instance. Called
# directly from an async handler it does not just make *that* request slow, it
# freezes the entire worker — every other user's dashboard, every poll, every
# in-flight AI call stalls for the duration.
#
# That is why logins felt fine alone and terrible with two people using the app:
# five simultaneous logins took 882ms and ran strictly one after another,
# because none of them ever yielded. Pushed to a thread they overlap, and
# nothing else on the worker is held up.
#
# Same rule as the Apify SDK (rule 7 in CLAUDE.md), applied to CPU work rather
# than to blocking I/O.
# ---------------------------------------------------------------------------

async def hash_password_async(password: str) -> str:
    return await run_in_threadpool(pwd_context.hash, password)


async def verify_password_async(password: str, hashed: str) -> bool:
    return await run_in_threadpool(pwd_context.verify, password, hashed)


#: A real bcrypt hash of a value nobody can log in with, used to spend the same
#: CPU on a missing account as on a real one. Without it, "no such user" returns
#: in ~1ms and "wrong password" in ~180ms, which is a reliable oracle for
#: discovering which email addresses have accounts on Crewaa.
_DUMMY_HASH = pwd_context.hash("crewaa-timing-equaliser-not-a-real-password")


async def waste_equivalent_time() -> None:
    """Spend a verify's worth of CPU so a missing account is indistinguishable."""
    await verify_password_async("crewaa-timing-equaliser-not-a-real-password", _DUMMY_HASH)

# Token types. Every token Crewaa issues is signed with the same secret, so the
# signature alone proves only "we made this" — never "this is the kind of token
# you are holding". The `type` claim is what separates them, and it is checked
# on the way in, not merely set on the way out.
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def create_access_token(data: dict, expires_minutes: int):
    payload = data.copy()
    # Marks this as a full session token. get_current_user() rejects any token
    # carrying a "purpose" claim, so a setup token can never be used as one.
    payload["type"] = ACCESS_TOKEN_TYPE
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int, token_version: int, expires_days: int) -> str:
    """
    Mint a refresh token: long-lived, and good for exactly one thing — asking
    for a new access token at POST /auth/refresh.

    It deliberately carries **no role claim**. A refresh token outlives any
    single session, so a role baked into it would keep asserting whatever the
    user was when they signed in; an admin demoted to brand would carry admin
    in their pocket until the token expired. The role is read from the database
    on every refresh instead.

    `ver` is what makes logout mean something. Without it a refresh token stays
    valid for its full lifetime no matter what the user does, so "log out" on a
    shared or stolen machine would clear a cookie the attacker already copied.
    Bumping `users.token_version` invalidates every refresh token ever issued
    to that account, in one write.
    """
    payload = {
        "sub": str(user_id),
        "ver": token_version,
        "type": REFRESH_TOKEN_TYPE,
        # A unique id per token. Without it the payload is fully determined by
        # (sub, ver, exp), and `exp` only has one-second resolution — so a
        # refresh issued in the same second as the previous one produced a
        # byte-identical JWT. Rotation that returns the same string is not
        # rotation: the old cookie keeps working because it *is* the new one.
        # Caught by test_the_refresh_token_is_rotated_on_use.
        "jti": uuid4().hex,
        "exp": datetime.utcnow() + timedelta(days=expires_days),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
