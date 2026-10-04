from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.common.dependencies import get_db
from app.core.config import settings
from app.modules.auth.schemas import (
    SignupRequest, LoginRequest, TokenResponse,
    GoogleAuthRequest, GoogleAuthResponse, SetPasswordRequest
)
from app.modules.auth.service import (
    authenticate_user, find_user_by_email, google_auth, issue_access_token,
    issue_refresh_token, refresh_access_token, revoke_refresh_tokens,
    set_password_service, signup_user,
)
from app.common.rate_limit import (
    check_login_allowed, clear_login_failures, rate_limit, record_login_failure,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """
    Put the refresh token in an httpOnly cookie.

    httpOnly specifically, and not localStorage next to the access token. The
    access token already lives in localStorage and is readable by any script on
    the page (CLAUDE.md rule 12) — but it expires in minutes. A refresh token
    lasts REFRESH_TOKEN_EXPIRE_DAYS, so putting it in the same place would mean
    a single XSS bug yields a session lasting weeks instead of minutes, and the
    short access lifetime would buy nothing.

    `secure` and `samesite` come from config because they differ by
    environment — see the note on Settings.cookie_samesite.
    """
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    # The attributes must match the ones the cookie was set with, or the
    # browser treats it as a different cookie and quietly leaves the real one
    # in place.
    response.delete_cookie(
        key=REFRESH_COOKIE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


# NOTE: this module used to define its own local copy of `get_db`, duplicating
# the one in app/common/dependencies.py. Two session providers meant auth routes
# silently bypassed anything applied to the shared dependency — including test
# overrides. Always use the shared dependency.

# Credential endpoints are throttled by IP: without this, /login is an
# unbounded password-guessing oracle and /signup an unbounded account-creation one.
@router.post(
    "/signup",
    response_model=TokenResponse,
    dependencies=[rate_limit(10, 3600, "signup")],
)
async def signup(
    data: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await signup_user(db, data.email, data.password, data.role)

    # Mint the token from the user we just created, rather than calling
    # authenticate_user. That re-read the row and ran a second bcrypt operation
    # to verify a password we had just hashed ourselves — doubling the cost of
    # the slowest thing in the request for no additional certainty.
    access_token, role = issue_access_token(user)
    _set_refresh_cookie(response, issue_refresh_token(user))
    return {"access_token": access_token, "role": role}


@router.post(
    "/login",
    response_model=TokenResponse,
    # A coarse flood guard only. The real protection is the failure counter
    # below: this one is deliberately loose because it counts every attempt,
    # including the successful ones.
    dependencies=[rate_limit(60, 300, "login_flood")],
)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Sign in.

    Lockout is counted on **failures only**, per email+IP. The previous throttle
    counted every attempt against the IP, so somebody who mistyped their
    password a few times and then typed it correctly was answered with "Too many
    requests" — right credentials, refused anyway, and no way to tell that from
    the app being broken.
    """
    check_login_allowed(
        request, data.email,
        settings.login_max_failures,
        settings.login_failure_window_seconds,
    )

    try:
        access_token, role = await authenticate_user(db, data.email, data.password)
    except HTTPException as exc:
        if exc.status_code == 401:
            record_login_failure(request, data.email, settings.login_failure_window_seconds)
        raise

    clear_login_failures(request, data.email)

    # Safe to re-read: authenticate_user has already proven the password, so
    # this is a lookup, not a second credential check.
    user = await find_user_by_email(db, data.email)
    if user:
        _set_refresh_cookie(response, issue_refresh_token(user))

    return {"access_token": access_token, "role": role}


@router.post(
    "/google",
    response_model=GoogleAuthResponse,
    dependencies=[rate_limit(20, 300, "google")],
)
async def google_login(
    data: GoogleAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result, user = await google_auth(db, data.id_token, data.role)

    # Only a completed sign-in gets a refresh cookie. The other branches return
    # a *setup* token and no session at all — the account has no password yet —
    # so issuing a weeks-long refresh token there would hand out a durable
    # session for an account nobody has finished securing. `google_auth`
    # returns the user only in the branch where that is true.
    if user is not None:
        _set_refresh_cookie(response, issue_refresh_token(user))

    return result


@router.post(
    "/set-password",
    response_model=TokenResponse,
    dependencies=[rate_limit(10, 900, "set_password")],
)
async def set_password(
    data: SetPasswordRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    access_token, role, user = await set_password_service(
        db, data.setup_token, data.password
    )
    _set_refresh_cookie(response, issue_refresh_token(user))
    return {"access_token": access_token, "role": role}


@router.post(
    "/refresh",
    response_model=TokenResponse,
    # Loose by design: a legitimate client refreshes roughly once per access
    # token lifetime, but several tabs can refresh at once. The real limit on
    # abuse is the token itself — a request without a valid refresh cookie is
    # rejected before anything expensive happens.
    dependencies=[rate_limit(120, 300, "refresh")],
)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange the refresh cookie for a new access token.

    Deliberately not behind `get_current_user`: the whole point is to be
    callable when the access token has already expired.
    """
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    access_token, role, user = await refresh_access_token(db, refresh_token)

    # Rotate on every use. A refresh token that never changes is a single
    # long-lived credential moving back and forth across the network; rotating
    # means a copy captured once stops working as soon as the real client
    # refreshes again.
    _set_refresh_cookie(response, issue_refresh_token(user))

    return {"access_token": access_token, "role": role}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    End the session everywhere, not just in this browser.

    This used to only delete a cookie that nothing ever set, so "log out" was
    decorative. Now it bumps the account's token version, which invalidates
    every refresh token already issued — including one copied off a shared
    machine before the user signed out.

    The access token in localStorage is still valid until it expires; the
    frontend clears it, and its lifetime is minutes. Revoking those too would
    mean a database read on every single authenticated request, which is a real
    cost for a small window.

    Always answers 204. Someone whose cookie is already expired or missing is
    trying to end a session that is already over, and reporting that as an
    error gives them nothing to do about it.
    """
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            _, _, user = await refresh_access_token(db, token)
            await revoke_refresh_tokens(db, user)
        except HTTPException:
            pass

    _clear_refresh_cookie(response)
    return
