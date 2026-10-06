from datetime import datetime

from pydantic import BaseModel


class AuthenticitySignal(BaseModel):
    key: str
    label: str
    status: str  # good | warn | bad | unknown
    value: str | None = None
    detail: str


class AuthenticityPlatformReport(BaseModel):
    platform: str
    score: int | None = None
    level: str
    signals: list[AuthenticitySignal]
    audience: int | None = None
    computed_at: datetime


class AuthenticityResponse(BaseModel):
    creator_id: int
    reports: list[AuthenticityPlatformReport]
    #: Shown with every score, so it is never read as a verdict.
    disclaimer: str = (
        "An estimate from public data. It looks for patterns common with fake or bought "
        "audiences; it cannot prove an account is real or fake."
    )


class AuthenticitySummary(BaseModel):
    """Headline used on creator cards in brand screens."""
    score: int | None = None
    level: str
    platform: str | None = None
    computed_at: datetime | None = None
    highlights: list[str] = []
