"""Add token_version to users (refresh-token revocation, V2 §2.3)

Revision ID: a4d81e37c6b2
Revises: c8e1b47f2a93
Create Date: 2026-10-04

Refresh tokens carry the version they were minted under. Incrementing this
column invalidates every refresh token outstanding for that account, which is
what makes logout and a password change actually end a session rather than
just clearing a cookie the holder may already have copied.

`server_default="0"` matters on a populated table: existing rows need a value
for the NOT NULL to be satisfiable, and every live user must land on the same
starting version as the tokens they will be issued next.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4d81e37c6b2"
down_revision: Union[str, Sequence[str], None] = "c8e1b47f2a93"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
