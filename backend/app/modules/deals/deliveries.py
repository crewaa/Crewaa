"""
Delivery tracking (V2 §1.4) — proof that the agreed work actually happened.

Anchored on the **accepted offer**, not on the interest. You deliver against
terms that were agreed, and the agreed offer is the only row that says what was
owed. Hanging deliveries off the interest would let a submission exist for a
deal nobody ever struck.

**Submissions are immutable**, the same rule as offers and for the same reason:
this is evidence. "You never posted it" and "I posted it on the 3rd" are the
two sentences a marketplace has to be able to settle, and it can only do that
if a submission and its timestamp cannot be edited afterwards. Resubmitting
writes a new row pointing at the old one via `supersedes_id`.

The deal being *complete* is deliberately **derived, not stored**. A
`delivered` flag on the offer would be a second source of truth that drifts the
first time a brand approves something and a write fails halfway. Completion is
computed in `delivery_state()` from the submissions themselves.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DeliveryStatus:
    SUBMITTED = "submitted"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    #: Replaced by a newer submission for the same deliverable.
    SUPERSEDED = "superseded"

    #: Statuses a brand may set when reviewing.
    REVIEWABLE = (APPROVED, CHANGES_REQUESTED)


class DealDelivery(Base):
    __tablename__ = "deal_deliveries"

    __table_args__ = (
        Index("ix_deal_deliveries_offer_created", "offer_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    #: The accepted offer this delivers against.
    offer_id: Mapped[int] = mapped_column(
        ForeignKey("deal_offers.id", ondelete="CASCADE"), index=True
    )
    submitted_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    #: Which deliverable this is. Copied from the agreed offer's list at submit
    #: time rather than referenced by index — the agreed list is immutable, but
    #: a label that reads "1x Reel (45s)" survives being looked at a year later
    #: in a way that "item 0" does not.
    label: Mapped[str] = mapped_column(String)
    #: Where the work is. A public post URL, normally.
    url: Mapped[str] = mapped_column(Text)
    #: Creator's note on submission.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String, default=DeliveryStatus.SUBMITTED, index=True
    )
    #: The brand's reason when asking for changes. The creator cannot act on
    #: "rejected" with no explanation.
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    supersedes_id: Mapped[int | None] = mapped_column(
        ForeignKey("deal_deliveries.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    submitter: Mapped["User"] = relationship("User", foreign_keys=[submitted_by_id])


def delivery_state(agreed_deliverables: list[str], submissions: list[DealDelivery]) -> dict:
    """
    Work out where a deal stands, from the submissions alone.

    Derived rather than stored so there is exactly one source of truth. The
    rules:

    * A deliverable is **done** when its newest live submission is approved.
    * A deal with an agreed deliverables list is **complete** when every one of
      them is done.
    * A deal with no list agreed (fee only) is complete once at least one
      submission is approved — the parties clearly settled the detail between
      themselves, and refusing to let them close would be pedantry.
    """
    live = [s for s in submissions if s.status != DeliveryStatus.SUPERSEDED]
    approved_labels = {
        s.label for s in live if s.status == DeliveryStatus.APPROVED
    }

    if agreed_deliverables:
        outstanding = [d for d in agreed_deliverables if d not in approved_labels]
        complete = not outstanding
    else:
        outstanding = []
        complete = bool(approved_labels)

    return {
        "complete": complete,
        "outstanding": outstanding,
        "approved_count": len(approved_labels),
        "expected_count": len(agreed_deliverables) or (1 if approved_labels else 0),
    }
