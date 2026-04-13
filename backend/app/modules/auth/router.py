from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.modules.auth.schemas import (
    SignupRequest, LoginRequest, TokenResponse,
    GoogleAuthRequest, GoogleAuthResponse, SetPasswordRequest
)
from app.modules.auth.service import signup_user, authenticate_user, google_auth, set_password_service


router = APIRouter(prefix="/auth", tags=["Auth"])

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/signup", response_model=TokenResponse)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await signup_user(db, data.email, data.password, data.role)

    token = authenticate_user(db, data.email, data.password)
    access_token, role = await token

    return {"access_token": access_token, "role": role}

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    access_token, role = await authenticate_user(db, data.email, data.password)
    return {"access_token": access_token, "role": role}


@router.post("/google", response_model=GoogleAuthResponse)
async def google_login(
    data: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await google_auth(db, data.id_token, data.role)
    return result


@router.post("/set-password", response_model=TokenResponse)
async def set_password(
    data: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    access_token, role = await set_password_service(db, data.setup_token, data.password)
    return {"access_token": access_token, "role": role}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    """
    Logs out the user by clearing auth cookies (refresh token).
    Access token is cleared on frontend.
    """

    # Clear refresh token cookie (future-proof)
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=False,  # set True in production (HTTPS)
        samesite="lax",
    )

    return
