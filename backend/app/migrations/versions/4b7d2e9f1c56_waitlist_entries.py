"""Waitlist entries for not-yet-launched parts (V3 Phase 3)

Revision ID: 4b7d2e9f1c56
Revises: 9c1e5a3d7b20
Create Date: 2026-10-06

Additive: one new table.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "4b7d2e9f1c56"
down_revision: Union[str, Sequence[str], None] = "9c1e5a3d7b20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("product", "email", name="uq_waitlist_product_email"),
    )
    op.create_index("ix_waitlist_entries_product", "waitlist_entries", ["product"])


def downgrade() -> None:
    op.drop_index("ix_waitlist_entries_product", table_name="waitlist_entries")
    op.drop_table("waitlist_entries")
