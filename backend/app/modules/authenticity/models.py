"""
Tables behind the Authenticity Score (V3 Phase 1).

* `audience_snapshots` — follower/subscriber count each time a creator is
  scraped, for both platforms. Growth-spike detection needs history, and
  `youtube_channels` is upserted (no history), so this is the one place both
  platforms' history lives. Pruned with the same retention as Instagram
  snapshots (SCRAPE_TTL_DAYS).
* `authenticity_reports` — the latest score per creator per platform, with the
  individual checks. Recomputed after every successful scrape. Comment text is
  never stored here, only aggregate counts.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.modules.users.models import JSON_COLUMN


class AudienceSnapshot(Base):
    __tablename__ = "audience_snapshots"
    __table_args__ = (
        Index("ix_audience_snapshots_user_platform_at", "user_id", "platform", "captured_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    audience: Mapped[int] = mapped_column(BigInteger, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class AuthenticityReport(Base):
    __tablename__ = "authenticity_reports"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_authenticity_reports_user_platform"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    #: 0–100, or null when there was not enough data to score.
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    #: "high" | "medium" | "low" | "insufficient"
    level: Mapped[str] = mapped_column(String, nullable=False)
    signals: Mapped[list] = mapped_column(JSON_COLUMN, nullable=False, default=list)
    #: Aggregate comment counts only — never comment text.
    comment_sample: Mapped[dict | None] = mapped_column(JSON_COLUMN, nullable=True)
    audience: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
