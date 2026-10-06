"""
Semantic pre-matching and the authenticity guard (V3 Phase 2).

Two stages decide who the model sees:

1. **Pre-match (this module).** Before the expensive ranking call, candidates
   are ordered by embedding similarity between the campaign and each creator
   (or, for a creator's brand deals, between the creator and each campaign),
   plus small bonuses for an exact niche and location match. Only the top
   AI_MAX_CREATORS_PER_PROMPT reach the model. Exact-niche ordering alone
   missed near-synonyms ("Fitness" vs "Health & wellness") and could not tell a
   food blogger from a restaurant reviewer within one niche.
2. **Ranking (the model)**, then the **authenticity guard** below, applied in
   code: a creator whose Authenticity Score is low cannot be shown as a High
   fit, whatever the model said.

Pre-matching is an optimisation, never a dependency: any failure (no API key,
quota, network) logs a warning and falls back to the V2 ordering.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.modules.ai.models import SemanticEmbedding

#: Added to cosine similarity (which sits roughly in 0.4–0.9 for related text).
NICHE_BONUS = 0.15
LOCATION_BONUS = 0.05
EMBED_BATCH = 100


# ------------------------------------------------------------------ text ----

def _clip(text: str | None, n: int) -> str:
    return " ".join((text or "").split())[:n]


def creator_document(creator, payload: dict) -> str:
    """What a creator is about, as text. Scraped text is untrusted, but an
    embedding only measures similarity — it cannot follow instructions."""
    parts = [
        f"Niche: {creator.category or ''}",
        f"Location: {creator.location or ''}",
        f"Primary platform: {creator.primary_platform or ''}",
        f"Bio: {_clip(creator.bio, 400)}",
    ]
    for platform in payload.get("platforms", []):
        if platform.get("platform") == "instagram":
            parts.append(f"Instagram bio: {_clip(platform.get('bio'), 300)}")
            captions = [_clip(p.get("caption"), 150) for p in platform.get("recent_posts", [])]
            parts.append("Recent posts: " + " | ".join(c for c in captions if c))
        elif platform.get("platform") == "youtube":
            parts.append(f"YouTube: {_clip(platform.get('title'), 100)}. {_clip(platform.get('description'), 300)}")
            titles = [_clip(v.get("title"), 100) for v in platform.get("recent_videos", [])]
            parts.append("Recent videos: " + " | ".join(t for t in titles if t))
    return "\n".join(p for p in parts if p.split(":", 1)[-1].strip())


def campaign_query(brand_data: dict) -> str:
    """What a brand is looking for, as text."""
    ident = brand_data.get("brand_identity", {})
    camp = brand_data.get("campaign") or {}
    parts = [
        f"Industry / niche: {ident.get('industry') or ''}",
        f"Goal: {_clip(ident.get('campaign_goal'), 300)}",
        f"Brand: {_clip(ident.get('description'), 300)}",
        f"Campaign type: {camp.get('type') or ''}",
        f"Brief: {_clip(camp.get('brief'), 600)}",
        f"Target location: {ident.get('target_location') or ''}",
        f"Platforms: {', '.join(brand_data.get('platform_preferences') or [])}",
    ]
    return "\n".join(p for p in parts if p.split(":", 1)[-1].strip())


def campaign_document(campaign) -> str:
    parts = [
        f"Niche: {campaign.niche or ''}",
        f"Campaign type: {campaign.campaign_type or ''}",
        f"Goal: {_clip(getattr(campaign, 'campaign_goal', None), 300)}",
        f"Brief: {_clip(campaign.brief, 600)}",
        f"Target location: {campaign.target_location or ''}",
    ]
    return "\n".join(p for p in parts if p.split(":", 1)[-1].strip())


# ----------------------------------------------------------- embeddings ----

def _hash(text: str) -> str:
    key = f"{settings.gemini_embedding_model}|{settings.embedding_dimensions}|{text}"
    return hashlib.sha256(key.encode()).hexdigest()


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Vectors are normalised at embed time, so this is a dot product."""
    return sum(x * y for x, y in zip(a, b))


async def ensure_embeddings(db: AsyncSession, client, kind: str, docs: dict[int, str]) -> dict[int, list[float]]:
    """
    Cached document vectors for `docs` ({ref_id: text}); embeds only what changed.

    Reads through the caller's session but writes the cache through a separate
    one. A failed cache write must never roll back the caller's session: that
    expires every object it loaded, and the next attribute read outside the
    async context raises MissingGreenlet (CLAUDE.md rule 24) — which is exactly
    what an early version of this function did when embeddings were unavailable.
    """
    if not docs:
        return {}
    existing = {
        r.ref_id: (r.source_hash, r.vector) for r in (await db.execute(
            select(SemanticEmbedding).where(
                SemanticEmbedding.kind == kind, SemanticEmbedding.ref_id.in_(list(docs))
            )
        )).scalars().all()
    }
    hashes = {rid: _hash(text) for rid, text in docs.items()}
    todo = [rid for rid in docs if rid not in existing or existing[rid][0] != hashes[rid]]

    fresh: dict[int, list[float]] = {}
    for i in range(0, len(todo), EMBED_BATCH):
        batch = todo[i:i + EMBED_BATCH]
        vectors = await client.embed([docs[rid] for rid in batch], "RETRIEVAL_DOCUMENT")
        fresh.update(zip(batch, vectors))

    if fresh:
        await _store(db, kind, {rid: (hashes[rid], vec) for rid, vec in fresh.items()})
        logger.info("Embedded {} {} document(s)", len(fresh), kind)

    return {rid: fresh.get(rid) or existing[rid][1] for rid in docs}


async def _store(db: AsyncSession, kind: str, rows: dict[int, tuple[str, list[float]]]) -> None:
    """Upsert cache rows in an independent session. Best-effort: a failure only costs a re-embed later."""
    try:
        async with AsyncSession(bind=db.bind, expire_on_commit=False) as w:
            current = {
                r.ref_id: r for r in (await w.execute(
                    select(SemanticEmbedding).where(
                        SemanticEmbedding.kind == kind, SemanticEmbedding.ref_id.in_(list(rows))
                    )
                )).scalars().all()
            }
            for rid, (digest, vec) in rows.items():
                row = current.get(rid) or SemanticEmbedding(kind=kind, ref_id=rid)
                row.source_hash, row.vector, row.updated_at = digest, vec, datetime.utcnow()
                w.add(row)
            await w.commit()
    except Exception as e:
        logger.warning("Could not cache {} embeddings: {}", kind, e)


async def semantic_order(
    db: AsyncSession,
    *,
    kind: str,
    query_text: str,
    items: list,
    doc_for,
    id_for,
    bonus_for=None,
    client=None,
) -> list | None:
    """
    `items` re-ordered by similarity to `query_text` (best first), or None when
    pre-matching is unavailable — the caller then keeps its own order. Never
    rolls back or commits the caller's session.
    """
    if not items or not query_text.strip():
        return None
    try:
        if client is None:
            from app.modules.ai.ai_service import GeminiClient
            client = GeminiClient()
        query_vec = (await client.embed([query_text], "RETRIEVAL_QUERY"))[0]
        vectors = await ensure_embeddings(db, client, kind, {id_for(it): doc_for(it) for it in items})
    except Exception as e:
        logger.warning("Semantic pre-matching unavailable, keeping default order: {}", e)
        return None

    def score(it) -> float:
        s = cosine(query_vec, vectors[id_for(it)])
        return s + (bonus_for(it) if bonus_for else 0.0)

    # sorted() is stable, so equal scores keep the caller's (niche-first) order.
    return sorted(items, key=score, reverse=True)


def niche_location_bonus(niche: str | None, location: str | None):
    def bonus(creator) -> float:
        b = 0.0
        if niche and (creator.category or "").strip().lower() == niche.strip().lower():
            b += NICHE_BONUS
        if location and (creator.location or "").strip().lower() == location.strip().lower():
            b += LOCATION_BONUS
        return b
    return bonus


# ---------------------------------------------------- authenticity guard ----

_FIT_ORDER = {"High": 0, "Medium": 1, "Low": 2}


def apply_authenticity_guard(ranked: list, summaries: dict[int, dict | None]) -> list:
    """
    Enforce in code what a prompt can only ask for:

    * Low Authenticity Score → never "High" fit (capped at Medium), and the
      concern is put first in the risks so the brand reads it before deciding.
    * Not enough data to score → a risk saying so, fit unchanged.

    Then orders by fit level, keeping the model's order within a level.
    `ranked` items need: creator_id, fit_level, risks (mutable list).
    """
    for item in ranked:
        summary = summaries.get(int(item.creator_id))
        if not summary:
            continue
        risks = list(item.risks or [])
        if summary.get("level") == "low":
            if item.fit_level == "High":
                item.fit_level = "Medium"
            reason = (summary.get("highlights") or ["Patterns common with bought audiences."])[0]
            risks.insert(0, f"Low Authenticity Score ({summary.get('score')}/100): {reason}")
        elif summary.get("level") == "insufficient":
            risks.append("Not enough public data yet for an Authenticity Score.")
        item.risks = risks

    return sorted(ranked, key=lambda r: _FIT_ORDER.get(r.fit_level, 3))
