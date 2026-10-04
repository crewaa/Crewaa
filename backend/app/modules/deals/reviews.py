"""
Two-way reviews (V2 §1.5) — the track record that makes a match worth more
than a cold DM.

Reviews are **double-blind**: neither side sees the other's rating until both
have submitted, or until a reveal window expires. This is not decoration. In a
two-sided marketplace where each party rates the other, whoever goes second can
see what they were given and answer in kind, so the first reviewer learns to
under-report problems and the ratings quietly stop meaning anything. Holding
both back until neither can react removes the incentive.

The window matters too: without it, one party simply never reviews and the
other's review is hidden forever, which is its own way of suppressing a bad
rating. After `REVIEW_REVEAL_DAYS` a submitted review reveals regardless.

Reveal is computed at read time rather than written by a scheduled job. There
is no job runner in this codebase (background work is still in-process — see
CLAUDE.md), and a stored `revealed` flag nobody flips would be worse than a
comparison against a timestamp.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

#: How long a review stays hidden while waiting for the other side.
REVIEW_REVEAL_DAYS = 14


class DealReview(Base):
    __tablename__ = "deal_reviews"

    __table_args__ = (
        # One review per person per deal. Rating someone twice for the same
        # piece of work is either a mistake or an attempt to weight the average.
        UniqueConstraint("interest_id", "author_id", name="uq_review_author_interest"),
        Index("ix_deal_reviews_subject", "subject_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    interest_id: Mapped[int] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: Who is being rated. Denormalised so a profile's reviews are one query
    #: rather than a join back through the interest to work out which side of
    #: it each review points at.
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    #: 1-5. Deliberately not a float — half stars invite precision nobody has.
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: "brand" or "creator" — which side the author was on.
    author_role: Mapped[str] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])
    subject: Mapped["User"] = relationship("User", foreign_keys=[subject_id])


def _as_utc(moment: datetime) -> datetime:
    """SQLite hands back naive datetimes; PostgreSQL does not."""
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def is_revealed(review: DealReview, both_submitted: bool) -> bool:
    """
    Whether this review may be shown to anyone other than its author.

    Revealed once both sides have had their say, or once the window has passed —
    the second rule stops a party suppressing a bad review by never writing one.
    """
    if both_submitted:
        return True
    age = datetime.now(timezone.utc) - _as_utc(review.created_at)
    return age >= timedelta(days=REVIEW_REVEAL_DAYS)


def summarise(reviews: list[DealReview]) -> dict:
    """
    Average rating and count over **revealed** reviews only.

    Counting hidden reviews would leak their contents: a rating that moves from
    4.8 to 4.2 the moment somebody submits tells you exactly what they said.
    """
    if not reviews:
        return {"average_rating": None, "review_count": 0}

    total = sum(r.rating for r in reviews)
    return {
        "average_rating": round(total / len(reviews), 2),
        "review_count": len(reviews),
    }
