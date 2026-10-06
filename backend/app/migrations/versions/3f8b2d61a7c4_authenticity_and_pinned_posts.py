"""Authenticity Score tables, pinned posts, audience history (V3 Phase 1)

Revision ID: 3f8b2d61a7c4
Revises: c7a3d84f1e09
Create Date: 2026-10-06

All additive — one new column and two new tables; nothing existing is altered
or dropped, so this is safe to run against production.

* `instagram_posts.is_pinned` — pinned posts are old by definition and were
  being counted as "latest". Existing rows default to false: we cannot know
  which past posts were pinned, and the next import corrects it.
* `audience_snapshots` — follower/subscriber history for both platforms, for
  growth-spike detection. Backfilled from the history that already exists:
  every stored Instagram snapshot, and the current YouTube channel row.
* `authenticity_reports` — latest score per creator per platform.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "3f8b2d61a7c4"
down_revision: Union[str, Sequence[str], None] = "c7a3d84f1e09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column(
        "instagram_posts",
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "audience_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("audience", sa.BigInteger(), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_audience_snapshots_user_platform_at",
        "audience_snapshots", ["user_id", "platform", "captured_at"],
    )

    op.create_table(
        "authenticity_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("signals", JSON_TYPE, nullable=False),
        sa.Column("comment_sample", JSON_TYPE, nullable=True),
        sa.Column("audience", sa.BigInteger(), nullable=True),
        sa.Column("computed_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "platform", name="uq_authenticity_reports_user_platform"),
    )
    op.create_index("ix_authenticity_reports_user_id", "authenticity_reports", ["user_id"])

    # Backfill growth history from what is already stored.
    op.execute(
        """
        INSERT INTO audience_snapshots (user_id, platform, audience, captured_at)
        SELECT user_id, 'instagram', followers, scraped_at
        FROM instagram_profiles
        WHERE followers IS NOT NULL AND followers > 0 AND scraped_at IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO audience_snapshots (user_id, platform, audience, captured_at)
        SELECT user_id, 'youtube', subscribers, scraped_at
        FROM youtube_channels
        WHERE subscribers IS NOT NULL AND subscribers > 0 AND scraped_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_authenticity_reports_user_id", table_name="authenticity_reports")
    op.drop_table("authenticity_reports")
    op.drop_index("ix_audience_snapshots_user_platform_at", table_name="audience_snapshots")
    op.drop_table("audience_snapshots")
    with op.batch_alter_table("instagram_posts") as batch:
        batch.drop_column("is_pinned")
