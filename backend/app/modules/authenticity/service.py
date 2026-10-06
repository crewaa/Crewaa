"""
Glue between scraped data and the pure scoring in scoring.py.

Called from the scrapers right after a successful import, while the comment
sample is still in memory. Every entry point here swallows its own errors after
logging: a scoring problem must never turn a successful import into a failure
(the same rule as scraping bookkeeping, see scraping/service.py).
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.modules.authenticity.comments import CommentQuality, assess_comments
from app.modules.authenticity.models import AudienceSnapshot, AuthenticityReport
from app.modules.authenticity.scoring import AudienceSample, ContentItem, score

#: Recent items considered. Matches what the scrapers fetch.
SAMPLE_SIZE = 12


async def record_audience(db: AsyncSession, user_id: int, platform: str, audience: int | None,
                          at: datetime | None = None) -> None:
    """Append one follower/subscriber reading and prune old ones."""
    if not audience or audience <= 0:
        return
    try:
        db.add(AudienceSnapshot(user_id=user_id, platform=platform, audience=audience,
                                captured_at=at or datetime.utcnow()))
        if settings.scrape_ttl_days > 0:
            cutoff = datetime.utcnow() - timedelta(days=settings.scrape_ttl_days)
            await db.execute(delete(AudienceSnapshot).where(
                AudienceSnapshot.user_id == user_id,
                AudienceSnapshot.platform == platform,
                AudienceSnapshot.captured_at < cutoff,
            ))
        await db.commit()
    except Exception as e:
        logger.warning("Could not record audience snapshot for user {} ({}): {}", user_id, platform, e)
        await db.rollback()


async def _history(db: AsyncSession, user_id: int, platform: str) -> list[tuple[datetime, int]]:
    rows = (await db.execute(
        select(AudienceSnapshot.captured_at, AudienceSnapshot.audience)
        .where(AudienceSnapshot.user_id == user_id, AudienceSnapshot.platform == platform)
        .order_by(AudienceSnapshot.captured_at)
    )).all()
    return [(r[0], int(r[1])) for r in rows]


async def update_report(
    db: AsyncSession,
    user_id: int,
    platform: str,
    audience: int,
    items: list[ContentItem],
    comment_texts: list[str] | None,
) -> AuthenticityReport | None:
    """Score the creator on one platform and upsert their report."""
    try:
        quality: CommentQuality | None = assess_comments(comment_texts) if comment_texts else None
        sample = AudienceSample(
            platform=platform,
            audience=audience,
            items=items[:SAMPLE_SIZE],
            history=await _history(db, user_id, platform),
            comments=quality,
        )
        result = score(sample)

        report = (await db.execute(
            select(AuthenticityReport).where(
                AuthenticityReport.user_id == user_id, AuthenticityReport.platform == platform)
        )).scalar()
        if report is None:
            report = AuthenticityReport(user_id=user_id, platform=platform)
            db.add(report)
        report.score = result.score
        report.level = result.level
        report.signals = [s.as_dict() for s in result.signals]
        report.comment_sample = quality.as_dict() if quality else None
        report.audience = audience
        report.computed_at = datetime.utcnow()
        await db.commit()
        logger.info("Authenticity for user {} on {}: {} ({})", user_id, platform, result.score, result.level)
        return report
    except Exception as e:
        logger.warning("Could not compute authenticity for user {} ({}): {}", user_id, platform, e)
        await db.rollback()
        return None


def summarise(reports: list[AuthenticityReport]) -> dict | None:
    """
    One headline for a creator across platforms, for cards in brand screens.

    The scored platform with the larger audience leads, since that is where a
    brand's money would mostly go. Two short reasons are surfaced: the worst
    checks first, so a brand sees the concern before the reassurance.
    """
    scored = [r for r in reports if r.score is not None]
    if not scored:
        return {"score": None, "level": "insufficient", "platform": None, "computed_at": None, "highlights": []} if reports else None
    lead = max(scored, key=lambda r: r.audience or 0)
    order = {"bad": 0, "warn": 1, "good": 2}
    sigs = sorted((s for s in (lead.signals or []) if s.get("status") in order), key=lambda s: order[s["status"]])
    return {
        "score": lead.score,
        "level": lead.level,
        "platform": lead.platform,
        "computed_at": lead.computed_at,
        "highlights": [s["detail"] for s in sigs[:2]],
    }


async def summaries_for(db: AsyncSession, user_ids: list[int]) -> dict[int, dict | None]:
    """Headline authenticity for many creators in one query."""
    if not user_ids:
        return {}
    rows = (await db.execute(
        select(AuthenticityReport).where(AuthenticityReport.user_id.in_(user_ids))
    )).scalars().all()
    by_user: dict[int, list[AuthenticityReport]] = {}
    for r in rows:
        by_user.setdefault(r.user_id, []).append(r)
    return {uid: summarise(by_user.get(uid, [])) for uid in user_ids}
