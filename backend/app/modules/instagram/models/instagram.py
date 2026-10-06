from sqlalchemy import String, Boolean, ForeignKey, DateTime, Text, Integer, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.core.database import Base


class InstagramProfile(Base):
    __tablename__ = "instagram_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    username: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_picture: Mapped[str | None] = mapped_column(String, nullable=True)
    followers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    following: Mapped[int | None] = mapped_column(Integer, nullable=True)
    posts_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_verified: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="instagram_profiles")


class InstagramPost(Base):
    __tablename__ = "instagram_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    shortcode: Mapped[str | None] = mapped_column(String, nullable=True)
    likes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_video: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    views: Mapped[int | None] = mapped_column(Integer, nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    #: Pinned posts sit at the top of a profile however old they are. They are
    #: kept for display but excluded from every average and from the AI, which
    #: is one of the causes of "sometimes old data" fixed in V3 Phase 1.
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="instagram_posts")
