"""Scheduled re-scrapes (V3 Phase 1): POST /internal/refresh-stale."""

from datetime import datetime, timedelta

import pytest

from app.core.config import settings
from app.modules.scraping.models import ScrapeJob, ScrapePlatform, ScrapeStatus
from tests.conftest import make_creator_profile, make_user


@pytest.fixture
def recorded(monkeypatch):
    """Capture batches instead of running real imports."""
    batches = []

    async def fake_run(batch):
        batches.append(batch)

    monkeypatch.setattr("app.modules.scraping.refresh.run_batch", fake_run)
    return batches


async def test_endpoint_does_not_exist_without_a_secret(client, monkeypatch, recorded):
    monkeypatch.setattr(settings, "cron_secret", "")
    res = await client.post("/internal/refresh-stale", headers={"X-Cron-Secret": "anything"})
    assert res.status_code == 404
    assert recorded == []


async def test_wrong_or_missing_secret_is_rejected(client, monkeypatch, recorded):
    monkeypatch.setattr(settings, "cron_secret", "s3cret-value")
    assert (await client.post("/internal/refresh-stale")).status_code == 401
    assert (await client.post("/internal/refresh-stale", headers={"X-Cron-Secret": "nope"})).status_code == 401
    assert recorded == []


async def test_refreshes_stalest_first_skips_fresh_and_running(client, session_factory, monkeypatch, recorded):
    from app.modules.instagram.models.instagram import InstagramProfile

    monkeypatch.setattr(settings, "cron_secret", "s3cret-value")
    monkeypatch.setattr(settings, "refresh_batch_size", 2)
    now = datetime.utcnow()

    never = await make_user(session_factory, "never@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, never.id, instagram_username="never")
    stale = await make_user(session_factory, "stale@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, stale.id, instagram_username="stale")
    staler = await make_user(session_factory, "staler@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, staler.id, instagram_username="staler")
    fresh = await make_user(session_factory, "fresh2@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, fresh.id, instagram_username="fresh")
    busy = await make_user(session_factory, "busy@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, busy.id, instagram_username="busy")

    async with session_factory() as db:
        db.add(InstagramProfile(user_id=stale.id, followers=1, scraped_at=now - timedelta(days=10)))
        db.add(InstagramProfile(user_id=staler.id, followers=1, scraped_at=now - timedelta(days=30)))
        db.add(InstagramProfile(user_id=fresh.id, followers=1, scraped_at=now - timedelta(days=1)))
        db.add(ScrapeJob(user_id=busy.id, platform=ScrapePlatform.INSTAGRAM,
                         status=ScrapeStatus.RUNNING, started_at=now))
        await db.commit()

    res = await client.post("/internal/refresh-stale", headers={"X-Cron-Secret": "s3cret-value"})

    assert res.status_code == 200
    assert res.json() == {"queued": 2, "instagram": 2, "youtube": 0}
    # Never-imported first, then the stalest; batch size caps the rest.
    assert recorded == [[(never.id, "instagram"), (staler.id, "instagram")]]


async def test_nothing_to_do_queues_nothing(client, monkeypatch, recorded):
    monkeypatch.setattr(settings, "cron_secret", "s3cret-value")
    res = await client.post("/internal/refresh-stale", headers={"X-Cron-Secret": "s3cret-value"})
    assert res.json()["queued"] == 0
    assert recorded == []
