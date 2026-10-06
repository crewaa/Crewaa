"""
Scheduled re-scrapes (V3 Phase 1) — keeps creator data fresh without paid infra.

A GitHub Actions schedule (.github/workflows/refresh-creators.yml) calls
`POST /internal/refresh-stale` every few hours. Each call picks the creators
whose data is oldest, up to REFRESH_BATCH_SIZE, and re-imports them one after
another in a background task.

Why not a worker: paid infrastructure is parked for later (VERSION-3-PLAN.md,
decision 17). The trade-off is the one that already exists for manual imports:
a deploy mid-run kills the batch, and the stuck-job sweeper cleans up. The next
scheduled run simply picks those creators up again, because they are still the
stalest.

Imports run sequentially with a pause between them, so a batch never competes
with real users for the single web instance.
"""

from __future__ import annotations

import asyncio
import hmac
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import get_db
from sqlalchemy import func, select

from app.core.config import settings
from app.core.logging import logger
from app.modules.instagram.models.instagram import InstagramProfile
from app.modules.scraping.models import ScrapeJob, ScrapePlatform, ScrapeStatus
from app.modules.users.models import CreatorProfile
from app.modules.youtube.models import YouTubeChannel

router = APIRouter(prefix="/internal", tags=["Internal"])

#: Seconds between imports inside one batch.
PAUSE_BETWEEN_IMPORTS = 3


async def pick_stale(db, now: datetime | None = None) -> list[tuple[int, str]]:
    """
    (user_id, platform) pairs to refresh, stalest first, at most the batch size.

    Creators who added a handle but never imported count as stalest of all.
    Anyone with an import already running is skipped.
    """
    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=settings.refresh_after_days)

    running = set((await db.execute(
        select(ScrapeJob.user_id, ScrapeJob.platform).where(ScrapeJob.status == ScrapeStatus.RUNNING)
    )).all())

    ig_last = dict((await db.execute(
        select(InstagramProfile.user_id, func.max(InstagramProfile.scraped_at)).group_by(InstagramProfile.user_id)
    )).all())
    yt_last = dict((await db.execute(
        select(YouTubeChannel.user_id, func.max(YouTubeChannel.scraped_at)).group_by(YouTubeChannel.user_id)
    )).all())

    creators = (await db.execute(
        select(CreatorProfile.user_id, CreatorProfile.instagram_username, CreatorProfile.youtube_username)
    )).all()

    candidates: list[tuple[datetime, int, str]] = []
    for user_id, ig, yt in creators:
        for handle, platform, last in (
            (ig, ScrapePlatform.INSTAGRAM, ig_last.get(user_id)),
            (yt, ScrapePlatform.YOUTUBE, yt_last.get(user_id)),
        ):
            if not handle or (user_id, platform) in running:
                continue
            if last is None or last < cutoff:
                candidates.append((last or datetime.min, user_id, platform))

    candidates.sort()
    return [(uid, platform) for _, uid, platform in candidates[: settings.refresh_batch_size]]


async def run_batch(batch: list[tuple[int, str]]) -> None:
    # Imported here: the scrapers import a lot, and this module is loaded at startup.
    from app.modules.instagram.services.instagram_scrapper import scrape_and_store
    from app.modules.youtube.service import scrape_and_store_youtube

    for i, (user_id, platform) in enumerate(batch):
        try:
            if platform == ScrapePlatform.INSTAGRAM:
                await scrape_and_store(user_id)
            else:
                await scrape_and_store_youtube(user_id)
        except Exception as e:
            # One creator's failure must not stop the rest of the batch.
            logger.error("Scheduled {} refresh failed for user {}: {}", platform, user_id, e)
        if i < len(batch) - 1:
            await asyncio.sleep(PAUSE_BETWEEN_IMPORTS)
    logger.info("Scheduled refresh finished: {} import(s)", len(batch))


@router.post("/refresh-stale")
async def refresh_stale(
    background_tasks: BackgroundTasks,
    x_cron_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a batch of re-imports for the creators with the oldest data.

    Not behind `get_current_user`: the caller is a scheduler, not a person. It is
    protected by a shared secret instead, compared in constant time, and the
    route does not exist at all (404) while no secret is configured.
    """
    if not settings.cron_secret:
        raise HTTPException(404, "Not found")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise HTTPException(401, "Invalid cron secret")

    batch = await pick_stale(db)

    if batch:
        background_tasks.add_task(run_batch, batch)
    logger.info("Scheduled refresh queued {} import(s)", len(batch))
    return {
        "queued": len(batch),
        "instagram": sum(1 for _, p in batch if p == ScrapePlatform.INSTAGRAM),
        "youtube": sum(1 for _, p in batch if p == ScrapePlatform.YOUTUBE),
    }
