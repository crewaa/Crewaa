from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.core.logging import logger
from app.modules.users.models import User
from app.core.security import (
    hash_password_async,
    verify_password_async,
    waste_equivalent_time,
    create_access_token,
    create_refresh_token,
    REFRESH_TOKEN_TYPE,
    SETUP_TOKEN_PURPOSE,
    MIN_PASSWORD_LENGTH,
)
from app.core.config import settings
from app.modules.auth.utils import verify_google_token
from datetime import datetime, timedelta
from jose import jwt, JWTError

SETUP_TOKEN_EXPIRE_MINUTES = 10


def normalise_email(email: str) -> str:
    """
    One canonical form for an address.

    `EmailStr` lowercases the domain but leaves the local part alone, so
    `Vishal@gmail.com` and `vishal@gmail.com` were two different accounts: you
    could sign up with one, type the other at the login screen, and be told your
    credentials were invalid. Nothing in the product hinted at why.

    Mail providers treat the local part as case-sensitive in theory. In practice
    none of the ones people actually use do, and matching that expectation is
    worth far more here than standards purity.
    """
    return email.strip().lower()


async def find_user_by_email(db: AsyncSession, email: str) -> User | None:
    """
    Look a user up case-insensitively.

    Compares on `lower(email)` rather than the stored value so accounts created
    before normalisation existed can still sign in. Ordered by id so that if a
    duplicate pair does exist, the same one is chosen every time rather than
    whichever the database happened to return first.
    """
    result = await db.execute(
        select(User)
        .where(func.lower(User.email) == normalise_email(email))
        .order_by(User.id)
    )
    return result.scalars().first()


def validate_password_strength(password: str) -> None:
    """Reject passwords that are trivially weak. Raises HTTPException."""
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            400,
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )


def create_setup_token(email: str, role: str) -> str:
    """Short-lived JWT used only to authorize the set-password step."""
    payload = {
        "purpose": SETUP_TOKEN_PURPOSE,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=SETUP_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_setup_token(token: str) -> dict:
    """Decode & validate the setup token. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != SETUP_TOKEN_PURPOSE:
            raise HTTPException(400, "Invalid setup token purpose")
        return payload
    except JWTError:
        raise HTTPException(400, "Invalid or expired setup token")


async def signup_user(db: AsyncSession, email: str, password: str, role: str):
    if role.upper() not in ("BRAND", "INFLUENCER"):
        raise HTTPException(403, "Accounts can only be created as BRAND or INFLUENCER")

    validate_password_strength(password)
    email = normalise_email(email)

    if await find_user_by_email(db, email):
        raise HTTPException(400, "An account with this email already exists. Please log in.")

    user = User(
        email=email,
        hashed_password=await hash_password_async(password),
        role=role.upper(),
    )
    db.add(user)

    try:
        await db.commit()
    except IntegrityError:
        # The check above is not a lock. Two requests for the same address — a
        # double submit, a retried request, two open tabs — both passed it and
        # both tried to insert, and the loser used to surface as a 500. The
        # unique index on users.email is the real guarantee; this turns losing
        # the race into the same answer the check would have given.
        await db.rollback()
        raise HTTPException(400, "An account with this email already exists. Please log in.")

    # Read the row back rather than `db.refresh(user)`.
    #
    # Two reasons, both observed under concurrent signups for the same address.
    # `refresh()` raises "Could not refresh instance" when this session's object
    # is no longer attached to a row it can see — which surfaced as a 500. And
    # more seriously, a losing insert can commit without raising, leaving an
    # in-memory object whose id was never written; minting a token from that
    # would issue a session for a user that does not exist.
    #
    # Re-reading gives whichever row actually won, or nothing at all.
    created = await find_user_by_email(db, email)
    if created is None:
        raise HTTPException(400, "Could not create the account. Please try again.")

    # Only report success if the row that exists is the one *this* request
    # inserted. Returning the winner's row to the loser would be far worse than
    # the 500 it replaced: two people racing to register the same address would
    # both be handed a session, and the one who lost would hold a valid token
    # for an account whose password they never set.
    if user.id is None or created.id != user.id:
        raise HTTPException(400, "An account with this email already exists. Please log in.")

    return created


def issue_access_token(user: User) -> tuple[str, str]:
    """Mint a session token for a user who has already been authenticated."""
    return create_access_token(
        {"sub": str(user.id), "role": user.role},
        settings.access_token_expire_minutes,
    ), user.role


def issue_refresh_token(user: User) -> str:
    """Mint the long-lived companion to an access token."""
    return create_refresh_token(
        user_id=user.id,
        token_version=user.token_version,
        expires_days=settings.refresh_token_expire_days,
    )


async def refresh_access_token(db: AsyncSession, refresh_token: str | None) -> tuple[str, str, User]:
    """
    Exchange a refresh token for a fresh access token.

    Returns `(access_token, role, user)` — the user comes back so the caller can
    rotate the cookie, and the role is read from the row rather than from the
    token (see `create_refresh_token` on why the role is not a claim).

    Every failure here answers 401 with the same wording. Distinguishing
    "expired" from "revoked" from "no cookie" would tell anyone holding a stolen
    token which of those it is, and there is nothing the legitimate user can do
    differently in any of those cases anyway: all three mean sign in again.
    """
    if not refresh_token:
        raise HTTPException(401, "Your session has expired. Please log in again.")

    try:
        payload = jwt.decode(
            refresh_token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(401, "Your session has expired. Please log in again.")

    # An access token must not be redeemable for another access token: that
    # would turn a token stolen from localStorage into an indefinitely
    # renewable session, which is the exact thing a short access lifetime is
    # supposed to prevent.
    if payload.get("type") != REFRESH_TOKEN_TYPE:
        raise HTTPException(401, "Your session has expired. Please log in again.")

    try:
        user_id = int(payload.get("sub", ""))
    except (TypeError, ValueError):
        raise HTTPException(401, "Your session has expired. Please log in again.")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar()
    if not user:
        raise HTTPException(401, "Your session has expired. Please log in again.")

    # The version check is the revocation. A token minted before the last
    # logout or password change carries an older number and dies here.
    if payload.get("ver") != user.token_version:
        raise HTTPException(401, "Your session has expired. Please log in again.")

    # Checked on refresh, not only at login: a refresh token issued days ago
    # must stop working the moment an admin disables the account, rather than
    # renewing happily until it expires on its own.
    if not user.is_active:
        raise HTTPException(403, "This account is disabled")

    access_token, role = issue_access_token(user)
    return access_token, role, user


async def revoke_refresh_tokens(db: AsyncSession, user: User) -> None:
    """
    Invalidate every refresh token outstanding for this account.

    Used by logout and by any password change. One increment covers tokens on
    every device, which is the behaviour people expect from "log out" on a
    machine that is not theirs.
    """
    user.token_version += 1
    await db.commit()


async def authenticate_user(db: AsyncSession, email: str, password: str):
    user = await find_user_by_email(db, email)

    if not user or not user.hashed_password:
        # Spend the same CPU a real verify would. Returning immediately made a
        # missing account answer in ~1ms and a wrong password in ~180ms, which
        # is a reliable way to discover which addresses have Crewaa accounts.
        await waste_equivalent_time()
        raise HTTPException(401, "Invalid email or password")

    if not await verify_password_async(password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    if not user.is_active:
        raise HTTPException(403, "This account is disabled")

    return issue_access_token(user)


async def google_auth(db, id_token: str, role: str | None) -> tuple[dict, User | None]:
    """
    Returns `(response_body, user_or_None)`.

    The user is returned only when this call actually signed somebody in. The
    other two branches hand back a short-lived *setup* token for an account
    with no password, which is not a session and must not earn a refresh token.
    """
    payload = await verify_google_token(id_token)
    email = normalise_email(payload["email"])

    user = await find_user_by_email(db, email)

    # CASE 1: Existing user who already has a password → direct login
    if user and user.hashed_password:
        if not user.is_active:
            raise HTTPException(403, "This account is disabled")
        token, role_name = issue_access_token(user)
        return (
            {"access_token": token, "role": role_name, "needs_password": False},
            user,
        )

    # CASE 2: Existing Google-only user (no password yet) → ask them to set one
    if user and not user.hashed_password:
        setup_token = create_setup_token(email=email, role=user.role)
        return (
            {"needs_password": True, "setup_token": setup_token, "email": email},
            None,
        )

    # CASE 3: Brand new user → create account, then ask to set password
    if not role:
        raise HTTPException(
            status_code=400,
            detail="Role is required for first-time signup",
        )

    user = User(
        email=email,
        role=role,
        hashed_password=None,  # Will be set via /auth/set-password
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # Same race as password signup: two Google popups completing at once.
        await db.rollback()
        user = await find_user_by_email(db, email)
        if user is None:
            raise HTTPException(400, "Could not create the account. Please try again.")

    setup_token = create_setup_token(email=email, role=role)
    # No user returned: this account has no password yet, so there is no
    # session to issue a refresh token for.
    return ({"needs_password": True, "setup_token": setup_token, "email": email}, None)


async def set_password_service(db: AsyncSession, setup_token: str, password: str):
    """
    Validate the setup token, set the password, and start a real session.

    Returns `(access_token, role, user)`. The user comes back because the router
    needs it to mint the refresh token, and re-reading the row there would be a
    second query for something this function already has in hand.
    """
    token_data = decode_setup_token(setup_token)
    email = normalise_email(token_data["email"])

    validate_password_strength(password)

    user = await find_user_by_email(db, email)

    if not user:
        raise HTTPException(404, "User not found")

    # A setup token may only ever complete an account that has no password yet.
    # Without this guard, any leaked/replayed setup token would be a password
    # reset for an already-secured account.
    if user.hashed_password:
        raise HTTPException(
            400,
            "This account already has a password. Please log in instead.",
        )

    if not user.is_active:
        raise HTTPException(403, "This account is disabled")

    user.hashed_password = await hash_password_async(password)

    # Setting a password ends any session that predates it. Nothing should
    # outlive the moment an account first gains a credential.
    user.token_version += 1

    await db.commit()
    await db.refresh(user)

    access_token, role = issue_access_token(user)
    return access_token, role, user
