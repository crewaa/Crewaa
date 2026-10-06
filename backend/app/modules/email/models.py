"""
Email notifications (V3 Phase 4).

Two tables:

* ``email_outbox`` — every email Crewaa means to send. A row is written in the
  same transaction as the event it describes (see ``notify()``), so an email can
  never go out about an offer whose own save failed, and nothing is lost if the
  process dies before sending: the next delivery run picks it up.
* ``email_preferences`` — what each person wants by email. No row means the
  defaults (everything on), so existing users need no backfill.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailCategory:
    """What a person can switch off. Plain strings, like NotificationKind."""

    MESSAGES = "messages"   # new messages in a conversation
    DEALS = "deals"         # interest, offers, delivery, reviews
    CREW = "crew"           # Crewaa Crew request updates (Phase 5)
    #: One-off confirmations someone asked for (the waitlist). Not optional and
    #: not tied to an account, so there is no preference to check.
    TRANSACTIONAL = "transactional"

    OPTIONAL = (MESSAGES, DEALS, CREW)


class EmailStatus:
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    SKIPPED = "skipped"     # not sent on purpose: preference, inactive, email off, expired
    FAILED = "failed"       # gave up after retries


class EmailOutbox(Base):
    __tablename__ = "email_outbox"

    __table_args__ = (
        Index("ix_email_outbox_status_created", "status", "created_at"),
        Index("ix_email_outbox_thread", "user_id", "kind", "interest_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    #: The account it is for. The address is looked up at send time, so a
    #: changed email is respected and a deleted account sends nothing.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: Only for emails to someone without an account (waitlist confirmation).
    to_email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    category: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(32))

    subject: Mapped[str] = mapped_column(String(200))
    #: Plain text, already final. Escaped when rendered into HTML.
    body: Mapped[str] = mapped_column(Text)
    #: Frontend path the button opens, e.g. /dashboard/messages/12.
    link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(60), nullable=True)

    interest_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(
        String(16), server_default=text("'pending'"), default=EmailStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)
    last_error: Mapped[str | None] = mapped_column(String(300), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailPreference(Base):
    __tablename__ = "email_preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    messages: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    deals: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    crew: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
