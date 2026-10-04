"""
Deal terms — the specific agreement between one brand and one creator (V2 §1.2).

This is **not** the campaign's terms. A campaign states what a brand is offering
to anyone who fits; this states what these two parties actually agreed, which
may differ after a negotiation. Conflating them is how a creator ends up holding
a brand to a number that was never meant for them.

**Offers are immutable.** Countering does not edit the previous offer — it
writes a new row pointing back at it via `supersedes_id`. Two reasons, and the
second is the important one:

* The negotiation history is the record. "We agreed ₹30,000" is worth very
  little when either side can rewrite what was proposed.
* `accepted` points at one specific row forever. If offers were mutable, the
  agreed terms would silently change whenever someone edited the row that
  acceptance pointed at — a bug with real money attached.

Only the *latest* offer in a chain is live; everything behind it is history.

**Commission is deliberately absent.** Crewaa takes 20–25% under the agency
model (V2 §1.2), but the rate tier is unresolved and, per the plan, commission
is not calculated until a deal settles in the payment phase. Rather than guess a
number, nothing here records or displays one. When the payment work lands, the
rate must be **snapshotted onto the accepted offer** at acceptance time — a rate
change afterwards must never retroactively alter a deal someone already agreed
to. `commission_rate_pct` is reserved for exactly that and is null today.
"""

from datetime import date, datetime

from sqlalchemy import (
    Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OfferStatus:
    """
    Lifecycle of a single offer row.

    `SUPERSEDED` is set on the previous offer when someone counters, so "what is
    live right now" is answerable without walking the whole chain.
    """

    PROPOSED = "proposed"
    SUPERSEDED = "superseded"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"

    #: An offer in one of these is finished; the negotiation cannot continue.
    TERMINAL = (ACCEPTED, DECLINED, WITHDRAWN)


class OfferParty:
    BRAND = "brand"
    CREATOR = "creator"


class DealOffer(Base):
    __tablename__ = "deal_offers"

    __table_args__ = (
        Index("ix_deal_offers_interest_created", "interest_id", "created_at"),
        # At most one agreed deal per interest, enforced by the database rather
        # than by the handler's read-then-write. Two parties clicking Accept at
        # the same instant would otherwise both pass an application-level check
        # and commit two accepted rows — two agreed prices on one deal, with no
        # way to say afterwards which one was real.
        Index(
            "uq_deal_offers_one_accepted",
            "interest_id",
            unique=True,
            postgresql_where=text("status = 'accepted'"),
            sqlite_where=text("status = 'accepted'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    #: Anchored on the interest, exactly like messaging — that row already
    #: identifies this creator, this brand, this opportunity.
    interest_id: Mapped[int] = mapped_column(
        ForeignKey("opportunity_interests.id", ondelete="CASCADE"), index=True
    )

    #: Who put this on the table. Resolved server-side from the caller's role in
    #: the interest, never sent by the client.
    proposed_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    #: "brand" or "creator" — denormalised so the UI can label a bubble without
    #: re-resolving the interest for every offer in the chain.
    proposed_by_role: Mapped[str] = mapped_column(String)

    #: The counter this one replaces, or null for the opening offer.
    supersedes_id: Mapped[int | None] = mapped_column(
        ForeignKey("deal_offers.id", ondelete="SET NULL"), nullable=True
    )

    # --- The terms themselves -------------------------------------------------
    #: Numeric, not float: money compared or summed in floating point eventually
    #: disagrees with someone's invoice.
    fee: Mapped[float] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String, default="INR")
    #: JSON-encoded list of strings, matching the convention campaigns already
    #: use for deliverables.
    deliverables: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: Free text from the proposer — "can you also do a story?" and so on.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String, default=OfferStatus.PROPOSED, index=True)

    #: Reserved for the payment phase. See the module docstring: the rate in
    #: force at acceptance must be frozen here, not looked up later.
    commission_rate_pct: Mapped[float | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    #: When it reached a terminal state, and who put it there. `responded_by_id`
    #: is null for `superseded`, which nobody actively chooses.
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    responded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    proposer: Mapped["User"] = relationship("User", foreign_keys=[proposed_by_id])
