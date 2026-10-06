"""Semantic embeddings cache for AI pre-matching (V3 Phase 2)

Revision ID: 9c1e5a3d7b20
Revises: 3f8b2d61a7c4
Create Date: 2026-10-06

Additive: one new table. Rows are a cache — they are created lazily the first
time a creator or campaign takes part in matching, and can be deleted at any
time without losing anything but the embedding cost to rebuild them.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "9c1e5a3d7b20"
down_revision: Union[str, Sequence[str], None] = "3f8b2d61a7c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "semantic_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("ref_id", sa.Integer(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("vector", JSON_TYPE, nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("kind", "ref_id", name="uq_semantic_embeddings_kind_ref"),
    )


def downgrade() -> None:
    op.drop_table("semantic_embeddings")
