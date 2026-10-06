"""
YouTube channel resolution (V3 Phase 1).

The scraper used a fuzzy `search` call, which could import a different,
more popular channel with a similar name. These pin the exact lookups.
"""

import pytest

from app.core.config import settings
from app.modules.scraping.errors import ProfileNotFoundError, ScrapeConfigurationError
from app.modules.youtube import scrapper
from app.modules.youtube.scrapper import parse_channel_ref, scrape_youtube_channel
from tests.conftest import make_creator_profile, make_user


@pytest.mark.parametrize("raw,expected", [
    ("@techwithrohan", ("handle", "@techwithrohan")),
    ("techwithrohan", ("handle", "@techwithrohan")),
    ("https://www.youtube.com/@techwithrohan", ("handle", "@techwithrohan")),
    ("youtube.com/@techwithrohan/videos", ("handle", "@techwithrohan")),
    ("https://youtube.com/channel/UC1234567890abcdefghijkl", ("id", "UC1234567890abcdefghijkl")),
    ("UC1234567890abcdefghijkl", ("id", "UC1234567890abcdefghijkl")),
    ("https://www.youtube.com/user/oldname", ("username", "oldname")),
    ("https://www.youtube.com/c/Custom", ("search", "Custom")),
    ("Tech With Rohan", ("search", "Tech With Rohan")),
])
def test_channel_references_are_parsed(raw, expected):
    assert parse_channel_ref(raw) == expected


def test_empty_reference_is_not_found():
    with pytest.raises(ProfileNotFoundError):
        parse_channel_ref("  ")


def _fake_api(monkeypatch, channels_by_param=None, search_hit=None):
    calls = []

    async def fake_get(client, path, params):
        calls.append((path, {k: v for k, v in params.items() if k != "part"}))
        if path == "channels":
            key = next(k for k in ("forHandle", "id", "forUsername") if k in params)
            item = (channels_by_param or {}).get((key, params[key]))
            return {"items": [item] if item else []}
        if path == "search":
            return {"items": [{"id": {"channelId": search_hit}}]} if search_hit else {"items": []}
        if path in ("playlistItems", "videos", "commentThreads"):
            return {"items": []}
        raise AssertionError(path)

    monkeypatch.setattr(scrapper, "_get", fake_get)
    monkeypatch.setattr(settings, "youtube_api_key", "test-key")
    return calls


CHANNEL = {
    "id": "UCexactexactexactexact12", "snippet": {"title": "Rohan", "description": ""},
    "statistics": {"subscriberCount": "52000"}, "contentDetails": {"relatedPlaylists": {}},
}


async def test_handle_uses_exact_lookup_not_search(monkeypatch):
    calls = _fake_api(monkeypatch, {("forHandle", "@techwithrohan"): CHANNEL})
    data = await scrape_youtube_channel("@techwithrohan")
    assert data["channel"]["channel_id"] == "UCexactexactexactexact12"
    assert data["channel"]["subscribers"] == 52000
    assert not any(path == "search" for path, _ in calls)


async def test_search_is_only_a_last_resort(monkeypatch):
    calls = _fake_api(monkeypatch, {("id", "UCexactexactexactexact12"): CHANNEL},
                      search_hit="UCexactexactexactexact12")
    data = await scrape_youtube_channel("Tech With Rohan")
    assert data["channel"]["channel_id"] == "UCexactexactexactexact12"
    assert [path for path, _ in calls][:2] == ["search", "channels"]


async def test_unknown_channel_is_the_creators_problem(monkeypatch):
    _fake_api(monkeypatch)
    with pytest.raises(ProfileNotFoundError):
        await scrape_youtube_channel("https://youtube.com/channel/UCnothingnothingnothing1")


async def test_missing_api_key_is_our_problem(monkeypatch):
    monkeypatch.setattr(settings, "youtube_api_key", "")
    with pytest.raises(ScrapeConfigurationError):
        await scrape_youtube_channel("@anyone")


async def test_config_failure_never_blames_the_creator(session_factory, monkeypatch):
    """CLAUDE.md rule 18, for YouTube."""
    user = await make_user(session_factory, "yt-config@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, youtube_username="@rohan")
    monkeypatch.setattr("app.modules.youtube.service.AsyncSessionLocal", session_factory)

    async def boom(_):
        raise ScrapeConfigurationError("YOUTUBE_API_KEY is not configured")

    monkeypatch.setattr("app.modules.youtube.service.scrape_youtube_channel", boom)
    from app.modules.scraping.models import ScrapeJob
    from app.modules.youtube.service import scrape_and_store_youtube
    from sqlalchemy import select

    await scrape_and_store_youtube(user.id)
    async with session_factory() as db:
        job = (await db.execute(select(ScrapeJob).where(ScrapeJob.user_id == user.id))).scalar()
    assert "on our side" in job.message
    assert "handle" not in job.message.lower()
