"""
Waitlist sign-ups for parts that have not launched (V3 Phase 3).

Only AI Influencers takes sign-ups today (VERSION-3-PLAN.md decision 12); Grow
and the Marketing Suite are deliberately "coming soon" with no form
(decision 16). `product` is a string so a later launch needs no migration.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (UniqueConstraint("product", "email", name="uq_waitlist_product_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product: Mapped[str] = mapped_column(String, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    #: Set when a signed-in user joins, so the team can see who is already a customer.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
