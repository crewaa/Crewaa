"""
Email delivery (V3 Phase 4).

How an email travels:

1. Something happens (a message, an offer, a delivery…). ``notify()`` stages
   the in-app notification *and* an ``email_outbox`` row on the caller's
   session. They commit together or not at all.
2. After that commit, if email is configured, a background task delivers what
   is pending (``deliver_pending``). It runs in this process, so nothing extra
   has to be hosted.
3. Anything that did not go — a restart mid-send, Resend down, the day's quota
   used — stays pending. The 6-hourly GitHub Actions job calls
   ``POST /internal/send-emails`` and it goes then.

Every send carries an idempotency key derived from the outbox id, and rows are
claimed before sending, so two deliveries racing never send the same email
twice.
"""

import asyncio
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.modules.email.models import EmailCategory, EmailOutbox, EmailPreference, EmailStatus
from app.modules.email.sender import EmailSender, OutgoingEmail, SendError, default_sender
from app.modules.email.templates import absolute, render_email

#: Notification kind → what a person can switch off. Kinds not listed are
#: never emailed. Strings rather than NotificationKind to avoid an import cycle.
CATEGORY_FOR_KIND = {
    "message": EmailCategory.MESSAGES,
    "interest": EmailCategory.DEALS,
    "offer": EmailCategory.DEALS,
    "delivery": EmailCategory.DEALS,
    "review": EmailCategory.DEALS,
    "crew": EmailCategory.CREW,
    "waitlist": EmailCategory.TRANSACTIONAL,
}

CTA_FOR_KIND = {
    "message": "Reply on Crewaa",
    "interest": "See who's interested",
    "offer": "Open the deal",
    "delivery": "Open the deal",
    "review": "Leave your review",
    "crew": "Open your request",
}

REASON_FOR_CATEGORY = {
    EmailCategory.MESSAGES: "You're getting this because someone messaged you on Crewaa.",
    EmailCategory.DEALS: "You're getting this because of activity on one of your Crewaa collaborations.",
    EmailCategory.CREW: "You're getting this because of an update on your Crewaa Crew request.",
}

CATEGORY_LABEL = {
    EmailCategory.MESSAGES: "new messages",
    EmailCategory.DEALS: "collaboration updates",
    EmailCategory.CREW: "Crewaa Crew updates",
    "all": "all Crewaa emails",
}

#: A pending email older than this is dropped: "you have a new message" three
#: days late is noise, and the bell has it anyway.
EXPIRE_AFTER = timedelta(days=3)
#: A row claimed this long ago without finishing belongs to a process that died.
STUCK_AFTER = timedelta(minutes=15)
MAX_ATTEMPTS = 3
#: Delivered/skipped rows are kept this long, for the admin's benefit, then pruned.
KEEP_FOR = timedelta(days=30)
#: Resend allows a few requests a second; stay well under it.
SEND_PAUSE_SECONDS = 0.6

_KICK = "crewaa_email_kick"


def email_enabled() -> bool:
    return bool(settings.resend_api_key)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------

async def stage_email(
    db: AsyncSession,
    *,
    kind: str,
    subject: str,
    body: str,
    user_id: int | None = None,
    to_email: str | None = None,
    link: str | None = None,
    cta_label: str | None = None,
    interest_id: int | None = None,
) -> bool:
    """
    Stage an email on the caller's session; the caller commits. Returns whether
    one was staged (False when the kind is not emailed, or a message email for
    this conversation already went out within the cooldown).
    """
    category = CATEGORY_FOR_KIND.get(kind)
    if category is None or (user_id is None and not to_email):
        return False

    if kind == "message" and interest_id is not None and user_id is not None:
        since = _now() - timedelta(minutes=settings.email_message_cooldown_minutes)
        recent = (await db.execute(
            select(EmailOutbox.id).where(
                EmailOutbox.user_id == user_id,
                EmailOutbox.kind == kind,
                EmailOutbox.interest_id == interest_id,
                EmailOutbox.created_at >= since,
            ).limit(1)
        )).scalar()
        if recent is not None:
            return False

    db.add(EmailOutbox(
        user_id=user_id,
        to_email=to_email,
        category=category,
        kind=kind,
        subject=subject[:200],
        body=body,
        link=link,
        cta_label=cta_label if cta_label is not None else CTA_FOR_KIND.get(kind),
        interest_id=interest_id,
    ))
    db.info[_KICK] = db.bind
    return True


# ---------------------------------------------------------------------------
# Kick delivery after the staging transaction commits
# ---------------------------------------------------------------------------

_running: set[asyncio.Task] = set()
_lock = asyncio.Lock()


@event.listens_for(Session, "after_commit")
def _deliver_after_commit(session: Session) -> None:
    bind = session.info.pop(_KICK, None)
    if bind is None or not email_enabled():
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(_deliver_quietly(bind))
    _running.add(task)
    task.add_done_callback(_running.discard)


@event.listens_for(Session, "after_rollback")
def _forget_after_rollback(session: Session) -> None:
    session.info.pop(_KICK, None)


async def _deliver_quietly(bind) -> None:
    """Background delivery must never raise into the event loop."""
    try:
        async with _lock:
            await deliver_pending(bind)
    except Exception:  # noqa: BLE001 — logged; the cron run retries
        logger.exception("Background email delivery failed")


# ---------------------------------------------------------------------------
# Unsubscribe tokens
# ---------------------------------------------------------------------------

def _sign(payload: str) -> str:
    key = hashlib.sha256(("email-unsubscribe:" + settings.jwt_secret_key).encode()).digest()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()[:32]


def unsubscribe_token(user_id: int, category: str) -> str:
    """
    Signed, and deliberately without expiry: an unsubscribe link in a year-old
    email still has to work.
    """
    payload = f"{user_id}.{category}"
    return f"{payload}.{_sign(payload)}"


def read_unsubscribe_token(token: str) -> tuple[int, str] | None:
    try:
        user_part, category, sig = token.split(".")
        user_id = int(user_part)
    except (ValueError, AttributeError):
        return None
    if category not in (*EmailCategory.OPTIONAL, "all"):
        return None
    if not hmac.compare_digest(sig, _sign(f"{user_id}.{category}")):
        return None
    return user_id, category


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------

async def get_preferences(db: AsyncSession, user_id: int) -> EmailPreference:
    """The stored preferences, or the defaults (everything on) if none are stored."""
    prefs = await db.get(EmailPreference, user_id)
    return prefs or EmailPreference(user_id=user_id, messages=True, deals=True, crew=True)


async def set_preferences(db: AsyncSession, user_id: int, **changes: bool) -> EmailPreference:
    prefs = await db.get(EmailPreference, user_id)
    if prefs is None:
        prefs = EmailPreference(user_id=user_id, messages=True, deals=True, crew=True)
        db.add(prefs)
    for key, value in changes.items():
        if key in EmailCategory.OPTIONAL and value is not None:
            setattr(prefs, key, bool(value))
    prefs.updated_at = _now()
    return prefs


def wants(prefs: EmailPreference, category: str) -> bool:
    if category == EmailCategory.TRANSACTIONAL:
        return True
    return bool(getattr(prefs, category, False))


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------

async def deliver_pending(
    bind,
    *,
    sender: EmailSender | None = None,
    limit: int = 20,
    pause: float = SEND_PAUSE_SECONDS,
    now: datetime | None = None,
) -> dict:
    """
    Send what is waiting, oldest first, within the daily limit. Opens its own
    session on `bind` so it never touches a request's transaction.
    """
    if not email_enabled():
        return {"enabled": False, "sent": 0}

    from app.modules.users.models import User  # local: avoids an import cycle

    now = now or _now()
    sender = sender or default_sender()
    counts = {"enabled": True, "sent": 0, "skipped": 0, "failed": 0, "deferred": 0}

    async with AsyncSession(bind=bind, expire_on_commit=False) as db:
        # Recover rows a dead process left half-done, and drop stale ones.
        await db.execute(
            update(EmailOutbox)
            .where(EmailOutbox.status == EmailStatus.SENDING, EmailOutbox.claimed_at < now - STUCK_AFTER)
            .values(status=EmailStatus.PENDING)
        )
        expired = await db.execute(
            update(EmailOutbox)
            .where(EmailOutbox.status == EmailStatus.PENDING, EmailOutbox.created_at < now - EXPIRE_AFTER)
            .values(status=EmailStatus.SKIPPED, last_error="expired")
        )
        counts["skipped"] += expired.rowcount or 0
        await db.execute(
            delete(EmailOutbox).where(
                EmailOutbox.status.in_((EmailStatus.SENT, EmailStatus.SKIPPED, EmailStatus.FAILED)),
                EmailOutbox.created_at < now - KEEP_FOR,
            )
        )
        await db.commit()

        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = (await db.execute(
            select(func.count(EmailOutbox.id)).where(
                EmailOutbox.status == EmailStatus.SENT, EmailOutbox.sent_at >= day_start
            )
        )).scalar() or 0
        budget = max(0, settings.email_daily_limit - sent_today)

        ids = (await db.execute(
            select(EmailOutbox.id)
            .where(EmailOutbox.status == EmailStatus.PENDING)
            .order_by(EmailOutbox.created_at, EmailOutbox.id)
            .limit(limit)
        )).scalars().all()

        first = True
        for outbox_id in ids:
            if budget <= 0:
                counts["deferred"] += 1
                continue

            claimed = await db.execute(
                update(EmailOutbox)
                .where(EmailOutbox.id == outbox_id, EmailOutbox.status == EmailStatus.PENDING)
                .values(status=EmailStatus.SENDING, claimed_at=now)
            )
            await db.commit()
            if not claimed.rowcount:
                continue  # another delivery got there first

            row = await db.get(EmailOutbox, outbox_id)

            # Who it goes to, and whether they still want it.
            to = row.to_email
            unsubscribe_url = settings_url = None
            reason = REASON_FOR_CATEGORY.get(row.category, "")
            headers: dict[str, str] = {}
            if row.user_id is not None and row.category != EmailCategory.TRANSACTIONAL:
                user = await db.get(User, row.user_id)
                prefs = await get_preferences(db, row.user_id)
                skip = None
                if user is None or not user.is_active:
                    skip = "inactive"
                elif not wants(prefs, row.category):
                    skip = "preference"
                if skip:
                    row.status, row.last_error = EmailStatus.SKIPPED, skip
                    await db.commit()
                    counts["skipped"] += 1
                    continue
                to = user.email
                token = unsubscribe_token(row.user_id, row.category)
                unsubscribe_url = absolute(f"/unsubscribe?token={token}")
                settings_url = absolute("/dashboard/settings")
                if settings.public_api_url:
                    api = settings.public_api_url.rstrip("/")
                    headers["List-Unsubscribe"] = f"<{api}/email/unsubscribe?token={token}>"
                    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
            elif row.kind == "waitlist":
                reason = ("You're getting this because this address joined a waitlist on crewaa.in. "
                          "If that wasn't you, ignore this email.")

            if not to:
                row.status, row.last_error = EmailStatus.SKIPPED, "no address"
                await db.commit()
                counts["skipped"] += 1
                continue

            rendered = render_email(
                subject=row.subject,
                body=row.body,
                cta_label=row.cta_label,
                cta_url=absolute(row.link),
                reason=reason,
                unsubscribe_url=unsubscribe_url,
                settings_url=settings_url,
            )

            if not first and pause:
                await asyncio.sleep(pause)
            first = False

            try:
                provider_id = await sender.send(OutgoingEmail(
                    to=to,
                    subject=row.subject,
                    html=rendered.html,
                    text=rendered.text,
                    idempotency_key=f"crewaa-email-{row.id}",
                    headers=headers,
                    tags={"category": row.category, "kind": row.kind},
                ))
            except SendError as exc:
                row.attempts += 1
                row.last_error = str(exc)[:300]
                if exc.rate_limited:
                    row.attempts -= 1  # not this email's fault
                    row.status = EmailStatus.PENDING
                    await db.commit()
                    counts["deferred"] += 1
                    break
                row.status = (
                    EmailStatus.PENDING if exc.retryable and row.attempts < MAX_ATTEMPTS
                    else EmailStatus.FAILED
                )
                await db.commit()
                counts["failed"] += 1
                logger.warning("Email {} not sent ({}): {}", row.id, row.status, row.last_error)
                continue

            row.status = EmailStatus.SENT
            row.sent_at = now
            row.provider_id = provider_id[:100] if provider_id else None
            row.last_error = None
            await db.commit()
            counts["sent"] += 1
            budget -= 1

    if counts["sent"] or counts["failed"]:
        logger.info("Email delivery: {}", counts)
    return counts
