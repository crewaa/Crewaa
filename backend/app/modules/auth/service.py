from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.modules.users.models import User
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.modules.auth.utils import verify_google_token
from app.core.security import create_access_token
from datetime import datetime, timedelta
from jose import jwt, JWTError

SETUP_TOKEN_PURPOSE = "set_password"
SETUP_TOKEN_EXPIRE_MINUTES = 10


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
    if role.upper() == "ADMIN":
        raise HTTPException(403, "Admin accounts cannot be created via signup")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar():
        raise HTTPException(400, "User already exists")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        role=role
    )
    db.add(user)
    await db.commit()
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar()

    if not user or not user.hashed_password:
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token(
        {"sub": str(user.id), "role": user.role},
        settings.access_token_expire_minutes
    )

    return token, user.role


async def google_auth(db, id_token: str, role: str | None):
    payload = await verify_google_token(id_token)
    email = payload["email"]

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar()

    # CASE 1: Existing user who already has a password → direct login
    if user and user.hashed_password:
        token = create_access_token(
            {"sub": str(user.id), "role": user.role},
            settings.access_token_expire_minutes,
        )
        return {"access_token": token, "role": user.role, "needs_password": False}

    # CASE 2: Existing Google-only user (no password yet) → ask them to set one
    if user and not user.hashed_password:
        setup_token = create_setup_token(email=email, role=user.role)
        return {"needs_password": True, "setup_token": setup_token, "email": email}

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
    await db.commit()
    await db.refresh(user)

    setup_token = create_setup_token(email=email, role=role)
    return {"needs_password": True, "setup_token": setup_token, "email": email}


async def set_password_service(db: AsyncSession, setup_token: str, password: str):
    """Validate the setup token, set the user's password, return a real access token."""
    token_data = decode_setup_token(setup_token)
    email = token_data["email"]

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar()

    if not user:
        raise HTTPException(404, "User not found")

    user.hashed_password = hash_password(password)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(
        {"sub": str(user.id), "role": user.role},
        settings.access_token_expire_minutes,
    )
    return access_token, user.role
