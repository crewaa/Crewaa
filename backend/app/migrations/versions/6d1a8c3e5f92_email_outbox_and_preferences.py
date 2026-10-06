"""Email notifications: outbox and preferences (V3 Phase 4)

Revision ID: 6d1a8c3e5f92
Revises: 4b7d2e9f1c56
Create Date: 2026-10-06

Additive: two new tables. No row in email_preferences means "everything on",
so existing users need no backfill.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "6d1a8c3e5f92"
down_revision: Union[str, Sequence[str], None] = "4b7d2e9f1c56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_outbox",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("to_email", sa.String(length=320), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("link", sa.String(length=300), nullable=True),
        sa.Column("cta_label", sa.String(length=60), nullable=True),
        sa.Column("interest_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_error", sa.String(length=300), nullable=True),
        sa.Column("provider_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_email_outbox_user_id", "email_outbox", ["user_id"])
    op.create_index("ix_email_outbox_status_created", "email_outbox", ["status", "created_at"])
    op.create_index("ix_email_outbox_thread", "email_outbox", ["user_id", "kind", "interest_id", "created_at"])

    op.create_table(
        "email_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("messages", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("deals", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("crew", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("email_preferences")
    op.drop_index("ix_email_outbox_thread", table_name="email_outbox")
    op.drop_index("ix_email_outbox_status_created", table_name="email_outbox")
    op.drop_index("ix_email_outbox_user_id", table_name="email_outbox")
    op.drop_table("email_outbox")
