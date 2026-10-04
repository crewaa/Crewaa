"""
Trust and safety (V2 Phase 3).

Three records, one concern: what happens when the other party is not acting in
good faith. Crewaa shipped messaging between strangers in August with no way to
report or block anyone, and shipped delivery records with no way to contest
one. These close both gaps.

The governing principle throughout is the one already established for delivery
and reviews (CLAUDE.md rule 16): **these records are evidence**. Blocking
someone does not delete the conversation, reporting does not edit it, and
raising a dispute does not change the delivery it concerns. Anything that let
one party rewrite the history would make the history worthless for settling the
argument it exists to settle.
"""

from datetime import datetime

from sqlalchemy import (
    DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReportReason:
    """
    Fixed set, because free text alone cannot be triaged. Stored as strings for
    the same reason `users.role` is — adding one is not a migration.
    """

    SPAM = "spam"
    HARASSMENT = "harassment"
    SCAM = "scam"
    IMPERSONATION = "impersonation"
    OFF_PLATFORM = "off_platform"      # pushing the deal outside Crewaa
    OTHER = "other"

    ALL = {SPAM, HARASSMENT, SCAM, IMPERSONATION, OFF_PLATFORM, OTHER}


class ReportStatus:
    OPEN = "open"
    REVIEWED = "reviewed"
    ACTIONED = "actioned"
    DISMISSED = "dismissed"


class DisputeStatus:
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class VerificationStatus:
    UNVERIFIED = "unverified"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

    ALL = {UNVERIFIED, PENDING, VERIFIED, REJECTED}


class UserBlock(Base):
    """
    One person refusing further contact from another.

    Deliberately **not** symmetric as a row, but symmetric in effect: a single
    block in either direction stops messages going *both* ways on that pair.
    Allowing the blocker to keep sending would turn block into a mute button
    that still lets you shout — a brand could block a creator and go on
    messaging them with no way to reply.

    Nothing is hidden or deleted. The thread stays readable to both sides,
    because the conversation is the evidence for any report filed about it.
    """

    __tablename__ = "user_blocks"

    __table_args__ = (
        # One block per direction. A double submit must not create two rows,
        # and unblocking must not have to delete an unknown number of them.
        UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    blocker_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    blocked_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )


class UserReport(Base):
    """
    A report an admin can act on.

    The reported person is never told. A report that notifies its subject is
    worse than no report at all: it invites retaliation, and the first thing
    anyone learns is that reporting makes their situation more dangerous.

    Reports are never deleted by the reporter either — a report withdrawn under
    pressure is exactly the one worth keeping.
    """

    __tablename__ = "user_reports"

    __table_args__ = (
        Index("ix_user_reports_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    reporter_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    reported_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    #: The thread it happened in, where there is one. Gives an admin the
    #: conversation to read rather than one side's description of it.
    interest_id: Mapped[int | None] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="SET NULL"), nullable=True
    )

    reason: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(16), default=ReportStatus.OPEN)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class DealDispute(Base):
    """
    "They say it was not delivered, I say it was."

    Full dispute resolution is explicitly out of scope for V2 — the plan calls
    for the flag plus admin visibility as the floor, and that is what this is.

    It sits *beside* the delivery record and never touches it. A dispute that
    could flip a submission's status would let either party rewrite the
    timestamped record the argument is about, which is the one thing that must
    stay fixed.
    """

    __tablename__ = "deal_disputes"

    __table_args__ = (
        Index("ix_deal_disputes_status_created", "status", "created_at"),
        # At most one open dispute per deal, enforced by the database rather
        # than by the handler — the same reasoning as
        # `uq_deal_offers_one_accepted`. A read-then-write check loses a real
        # race, and two open disputes on one deal have no sensible resolution.
        Index(
            "uq_deal_disputes_one_open",
            "interest_id",
            unique=True,
            sqlite_where=text("status = 'open'"),
            postgresql_where=text("status = 'open'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    interest_id: Mapped[int] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="CASCADE"), index=True
    )
    raised_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    reason: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(16), default=DisputeStatus.OPEN)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
