from pydantic import BaseModel, EmailStr
from typing import Optional

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    role: str  # BRAND | INFLUENCER

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str

class GoogleAuthRequest(BaseModel):
    id_token: str
    role: Optional[str] = None

# Returned when a new Google user needs to set a password
class GoogleAuthResponse(BaseModel):
    # If the user already has a password → these are populated
    access_token: Optional[str] = None
    token_type: str = "bearer"
    role: Optional[str] = None
    # If the user is brand new → these are populated
    needs_password: bool = False
    setup_token: Optional[str] = None
    email: Optional[str] = None

class SetPasswordRequest(BaseModel):
    setup_token: str
    password: str