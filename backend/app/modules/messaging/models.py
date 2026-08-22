"""
In-app messaging between a brand and a creator, anchored on the interest that
introduced them.

`opportunity_interests` already identifies exactly the right pair — "this
creator, this brand, this opportunity" — so a message thread does not need its
own conversation entity. A message is just a row scoped to an existing
interest, and the thread's participants are read straight off that interest.

V1's opportunity flow keeps the brand hidden from the creator until interest is
expressed. Messaging deliberately breaks that once a thread exists — the
creator opted in by expressing interest, and a conversation with someone whose
identity is still withheld does not make sense. That reveal happens only in
`messaging/router.py`'s counterpart resolution; nothing here or in the
opportunity/scrubbing code changes.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    __table_args__ = (
        Index("ix_messages_interest_created", "interest_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    interest_id: Mapped[int] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    body: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    #: Null until the recipient reads it. Set by the read-receipt endpoint,
    #: never by the sender's own request.
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
