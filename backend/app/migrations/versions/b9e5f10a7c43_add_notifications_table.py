"""Add notifications table (V2 §2.1)

Revision ID: b9e5f10a7c43
Revises: a4d81e37c6b2
Create Date: 2026-10-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9e5f10a7c43"
down_revision: Union[str, Sequence[str], None] = "a4d81e37c6b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link", sa.String(length=300), nullable=False),
        sa.Column(
            "interest_id", sa.Integer(),
            sa.ForeignKey("opportunity_interests.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_interest_id", "notifications", ["interest_id"])
    # The two queries that run on every dashboard load: the recent list, and
    # the unread count behind the bell.
    op.create_index(
        "ix_notifications_user_created", "notifications", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_notifications_user_unread", "notifications", ["user_id", "read_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_index("ix_notifications_interest_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
