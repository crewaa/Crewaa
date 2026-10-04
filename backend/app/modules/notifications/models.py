"""
In-app notifications (V2 §2.1).

Crewaa shipped four features whose entire value is that the other person
responds — messaging, offers, delivery, reviews — and nothing that tells anyone
something happened. A creator who received an offer found out by logging in and
looking. This is the floor: an unread count and a list, in the product itself.

Two decisions are worth stating, because both are easy to get wrong later.

**The text is stored, not derived.** A notification says what was true when it
fired. Rendering it from the live row instead would mean a notification reading
"Terms agreed — ₹45,000" silently changes if the record it points at changes,
and the whole point of an event feed is that it records what happened.

**The link is stored too.** Deriving the destination at read time couples every
historical notification to the current routing; a URL that moves would break
everything already sent.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NotificationKind:
    """
    Plain string constants, matching how `users.role` is handled — no database
    enum, so adding a kind is not a migration.
    """

    MESSAGE = "message"
    OFFER = "offer"
    DELIVERY = "delivery"
    REVIEW = "review"


class Notification(Base):
    __tablename__ = "notifications"

    __table_args__ = (
        # The two queries that actually run: "my unread count" and "my recent
        # notifications, newest first". Both are on every dashboard load, so
        # they are indexed together rather than relying on the user_id index
        # alone.
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", "read_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    #: The recipient — never the person who caused the event. A notification
    #: about your own action is noise, and more than one bug has been shipped
    #: by storing the actor here and filtering later.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    kind: Mapped[str] = mapped_column(String(32))

    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)

    #: Frontend path to open when clicked.
    link: Mapped[str] = mapped_column(String(300))

    #: The thread this concerns, where there is one. Used to collapse a burst
    #: of messages into a single unread entry rather than twenty.
    interest_id: Mapped[int | None] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
