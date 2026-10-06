"""
Cached embeddings for semantic pre-matching (V3 Phase 2).

One row per (kind, ref_id) — a creator profile or a campaign. `source_hash`
covers the embedded text plus the model and dimensions, so an edited bio, a new
scrape or a model change re-embeds that one row and nothing else.

Vectors are stored as JSON, not pgvector. At Crewaa's size the candidate pool is
at most AI_CANDIDATE_POOL rows, and cosine over a few hundred 768-d vectors in
Python takes milliseconds. pgvector (Neon supports it) becomes worth its
operational cost once nearest-neighbour search has to run across thousands of
rows *inside* the database — that is the trigger to revisit this.
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.modules.users.models import JSON_COLUMN


class SemanticEmbedding(Base):
    __tablename__ = "semantic_embeddings"
    __table_args__ = (UniqueConstraint("kind", "ref_id", name="uq_semantic_embeddings_kind_ref"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    #: "creator" (ref_id = users.id) or "campaign" (ref_id = campaigns.id)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    ref_id: Mapped[int] = mapped_column(Integer, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    vector: Mapped[list] = mapped_column(JSON_COLUMN, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
