"""Add trust & safety: blocks, reports, disputes, verification (V2 Phase 3)

Revision ID: c7a3d84f1e09
Revises: b9e5f10a7c43
Create Date: 2026-10-04

All additive: four new columns on `users` and three new tables. Nothing
existing is altered or dropped, so this is safe to run against production
without a rehearsal.

The verification columns carry server defaults because `users` is populated —
every existing account lands on 'unverified', which is the correct starting
state for an account nobody has reviewed.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c7a3d84f1e09"
down_revision: Union[str, Sequence[str], None] = "b9e5f10a7c43"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- verification, on users ----
    op.add_column(
        "users",
        sa.Column(
            "verification_status", sa.String(), nullable=False,
            server_default=sa.text("'unverified'"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("verification_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("verification_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("verification_note", sa.Text(), nullable=True))

    # ---- blocks ----
    op.create_table(
        "user_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "blocker_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "blocked_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_pair"),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])
    op.create_index("ix_user_blocks_blocked_id", "user_blocks", ["blocked_id"])

    # ---- reports ----
    op.create_table(
        "user_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "reporter_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "reported_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "interest_id", sa.Integer(),
            sa.ForeignKey("opportunity_interests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=16), nullable=False,
            server_default=sa.text("'open'"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewed_by_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("admin_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_user_reports_reporter_id", "user_reports", ["reporter_id"])
    op.create_index("ix_user_reports_reported_id", "user_reports", ["reported_id"])
    op.create_index(
        "ix_user_reports_status_created", "user_reports", ["status", "created_at"]
    )

    # ---- disputes ----
    op.create_table(
        "deal_disputes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "interest_id", sa.Integer(),
            sa.ForeignKey("opportunity_interests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "raised_by_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(length=16), nullable=False,
            server_default=sa.text("'open'"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "resolved_by_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("resolution_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_deal_disputes_interest_id", "deal_disputes", ["interest_id"])
    op.create_index("ix_deal_disputes_raised_by_id", "deal_disputes", ["raised_by_id"])
    op.create_index(
        "ix_deal_disputes_status_created", "deal_disputes", ["status", "created_at"]
    )
    # Partial unique index: at most one OPEN dispute per deal, enforced by the
    # database. Same reasoning as uq_deal_offers_one_accepted — a handler check
    # loses a genuine race, and two open disputes on one deal are unresolvable.
    op.create_index(
        "uq_deal_disputes_one_open",
        "deal_disputes",
        ["interest_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
        sqlite_where=sa.text("status = 'open'"),
    )


def downgrade() -> None:
    op.drop_index("uq_deal_disputes_one_open", table_name="deal_disputes")
    op.drop_index("ix_deal_disputes_status_created", table_name="deal_disputes")
    op.drop_index("ix_deal_disputes_raised_by_id", table_name="deal_disputes")
    op.drop_index("ix_deal_disputes_interest_id", table_name="deal_disputes")
    op.drop_table("deal_disputes")

    op.drop_index("ix_user_reports_status_created", table_name="user_reports")
    op.drop_index("ix_user_reports_reported_id", table_name="user_reports")
    op.drop_index("ix_user_reports_reporter_id", table_name="user_reports")
    op.drop_table("user_reports")

    op.drop_index("ix_user_blocks_blocked_id", table_name="user_blocks")
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")

    op.drop_column("users", "verification_note")
    op.drop_column("users", "verification_reviewed_at")
    op.drop_column("users", "verification_requested_at")
    op.drop_column("users", "verification_status")
