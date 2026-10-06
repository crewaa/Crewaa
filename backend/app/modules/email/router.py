"""
Email settings and unsubscribe (V3 Phase 4).

* ``GET/PUT /email/preferences`` — the signed-in person's choices.
* ``POST /email/unsubscribe`` — public, authorised by the signed token in the
  link. Works as the RFC 8058 one-click target (mail clients POST
  ``List-Unsubscribe=One-Click`` to it) and from the /unsubscribe page.
  Deliberately POST-only: link scanners follow GETs, and a scanner must not be
  able to unsubscribe someone by opening their email.
* ``POST /internal/send-emails`` — the scheduled retry, behind CRON_SECRET.
"""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_current_user, get_db
from app.common.rate_limit import rate_limit
from app.core.config import settings
from app.core.logging import logger
from app.modules.email.models import EmailCategory
from app.modules.email.service import (
    CATEGORY_LABEL, deliver_pending, get_preferences, read_unsubscribe_token, set_preferences,
)
from app.modules.users.models import User

router = APIRouter(tags=["Email"])


class EmailPreferencesOut(BaseModel):
    messages: bool
    deals: bool
    crew: bool
    #: Whether this server can send email at all, so the settings page can say
    #: so honestly instead of offering switches that do nothing.
    email_enabled: bool


class EmailPreferencesIn(BaseModel):
    messages: bool | None = None
    deals: bool | None = None
    crew: bool | None = None


def _out(prefs) -> EmailPreferencesOut:
    return EmailPreferencesOut(
        messages=prefs.messages, deals=prefs.deals, crew=prefs.crew,
        email_enabled=bool(settings.resend_api_key),
    )


@router.get("/email/preferences", response_model=EmailPreferencesOut)
async def read_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _out(await get_preferences(db, current_user.id))


@router.put("/email/preferences", response_model=EmailPreferencesOut)
async def update_preferences(
    data: EmailPreferencesIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = await set_preferences(db, current_user.id, **data.model_dump())
    await db.commit()
    return _out(prefs)


@router.post("/email/unsubscribe", dependencies=[rate_limit(300, 3600, "unsubscribe")])
async def unsubscribe(
    token: str = Query(..., max_length=200),
    db: AsyncSession = Depends(get_db),
):
    parsed = read_unsubscribe_token(token)
    if parsed is None:
        raise HTTPException(400, "This unsubscribe link isn't valid. You can change your emails in Settings.")
    user_id, category = parsed
    if await db.get(User, user_id) is None:
        # The account is gone, so nothing will be sent anyway.
        return {"status": "unsubscribed", "category": category, "label": CATEGORY_LABEL[category]}

    if category == "all":
        await set_preferences(db, user_id, **{c: False for c in EmailCategory.OPTIONAL})
    else:
        await set_preferences(db, user_id, **{category: False})
    await db.commit()
    logger.info("User {} unsubscribed from {}", user_id, category)
    return {"status": "unsubscribed", "category": category, "label": CATEGORY_LABEL[category]}


@router.post("/internal/send-emails")
async def send_emails(
    x_cron_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Deliver whatever is still pending. Same guard as /internal/refresh-stale."""
    if not settings.cron_secret:
        raise HTTPException(404, "Not found")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise HTTPException(401, "Invalid cron secret")
    return await deliver_pending(db.bind, limit=50)
