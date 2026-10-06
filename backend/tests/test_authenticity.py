"""
Authenticity Score (V3 Phase 1).

The scoring rules are pure functions, so most of this file pins their
behaviour exactly. The integration tests at the end check the parts that
matter for trust: pinned posts are excluded, comment text is never stored,
and only the right people can read a report.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.modules.authenticity.comments import assess_comments
from app.modules.authenticity.scoring import (
    AudienceSample, ContentItem, check_consistency, check_engagement, check_growth,
    check_likes_comments, check_reach, ig_benchmark, score,
)
from tests.conftest import auth_header, make_creator_profile, make_user

NOW = datetime(2026, 10, 6, 12, 0, 0)


def ig_items(n=10, likes=1_500, comments=40, video_every=2, views=12_000):
    return [
        ContentItem(likes=likes, comments=comments, is_video=(i % video_every == 0),
                    views=views if i % video_every == 0 else None)
        for i in range(n)
    ]


def history(*points):
    """points: (days_ago, audience)"""
    return [(NOW - timedelta(days=d), n) for d, n in points]


# --------------------------------------------------------------- comments ----

def test_comment_classifier_separates_generic_repeated_and_real():
    q = assess_comments([
        "Nice pic!", "🔥🔥🔥", "Great post", "where is this cafe? looks lovely",
        "Bhai recipe share karo please", "follow me", "check my profile",
        "This changed how I meal prep", "This changed how I meal prep", "   ", None,
    ])
    assert q.total == 9  # blanks and non-strings ignored
    assert q.low_effort == 1  # emoji-only
    assert q.generic == 4  # nice pic, great post, follow me, check my profile
    assert q.duplicates == 1  # the repeated real sentence
    assert q.suspicious_share == pytest.approx(5 / 9)


def test_comment_classifier_handles_empty_input():
    q = assess_comments([])
    assert q.total == 0 and q.suspicious_share is None


# --------------------------------------------------------------- checks ----

def test_ig_benchmarks_follow_the_published_tiers():
    assert ig_benchmark(5_000) == 0.06
    assert ig_benchmark(30_000) == 0.035
    assert ig_benchmark(200_000) == 0.025
    assert ig_benchmark(800_000) == 0.015
    assert ig_benchmark(3_000_000) == 0.008


def test_normal_micro_creator_engagement_is_good():
    # 1,540 / 40,000 = 3.85% vs 3.5% typical
    s = AudienceSample("instagram", 40_000, ig_items())
    assert check_engagement(s).status == "good"


def test_far_too_little_engagement_is_bad():
    # 100 followers' worth of engagement on 200K followers
    s = AudienceSample("instagram", 200_000, ig_items(likes=300, comments=5))
    assert check_engagement(s).status == "bad"


def test_unusually_high_engagement_is_only_a_warning():
    s = AudienceSample("instagram", 20_000, ig_items(likes=6_000, comments=200))
    sig = check_engagement(s)
    assert sig.status == "warn"


def test_bought_likes_pattern_is_flagged():
    s = AudienceSample("instagram", 50_000, ig_items(likes=5_000, comments=5))
    assert check_likes_comments(s).status == "bad"


def test_comment_groups_pattern_is_a_warning():
    s = AudienceSample("instagram", 50_000, ig_items(likes=200, comments=150))
    assert check_likes_comments(s).status == "warn"


def test_reach_needs_videos_on_instagram():
    s = AudienceSample("instagram", 50_000, ig_items(video_every=99))
    s.items = [ContentItem(likes=10, comments=1) for _ in range(5)]
    assert check_reach(s).status == "unknown"


def test_tiny_reach_is_bad():
    s = AudienceSample("instagram", 500_000, ig_items(views=2_000))
    assert check_reach(s).status == "bad"


def test_growth_needs_history_a_few_days_apart():
    s = AudienceSample("instagram", 10_000, [], history=history((1, 9_900), (0, 10_000)))
    assert check_growth(s).status == "unknown"


def test_sudden_follower_jump_is_bad():
    s = AudienceSample("instagram", 60_000, [],
                       history=history((20, 40_000), (12, 41_000), (8, 41_500), (5, 60_000)))
    sig = check_growth(s)
    assert sig.status == "bad"
    assert "+" in sig.value


def test_follower_purge_is_a_warning():
    s = AudienceSample("instagram", 40_000, [], history=history((10, 50_000), (5, 40_000)))
    assert check_growth(s).status == "warn"


def test_steady_growth_is_good():
    s = AudienceSample("instagram", 10_400, [],
                       history=history((30, 10_000), (21, 10_100), (14, 10_200), (7, 10_300), (0, 10_400)))
    assert check_growth(s).status == "good"


def test_one_viral_post_never_scores_as_bad():
    items = [ContentItem(likes=500, comments=10) for _ in range(9)] + [ContentItem(likes=90_000, comments=900)]
    sig = check_consistency(AudienceSample("instagram", 30_000, items))
    assert sig.status == "warn"


def test_youtube_bought_views_pattern():
    items = [ContentItem(likes=20, comments=1, views=50_000, is_video=True) for _ in range(6)]
    assert check_engagement(AudienceSample("youtube", 100_000, items)).status == "bad"


def test_youtube_normal_channel():
    items = [ContentItem(likes=1_500, comments=120, views=50_000, is_video=True) for _ in range(6)]
    s = AudienceSample("youtube", 200_000, items)
    assert check_engagement(s).status == "good"
    assert check_reach(s).status == "good"


# ------------------------------------------------------------------ score ----

def test_healthy_creator_scores_high():
    s = AudienceSample(
        "instagram", 40_000, ig_items(),
        history=history((21, 38_500), (14, 39_000), (7, 39_500), (0, 40_000)),
        comments=assess_comments([f"real comment number {i} about the recipe" for i in range(20)]),
    )
    result = score(s)
    assert result.level == "high"
    assert result.score == 100


def test_bought_audience_scores_low():
    s = AudienceSample(
        "instagram", 300_000, ig_items(likes=900, comments=1, views=1_000),
        history=history((14, 150_000), (10, 152_000), (6, 300_000)),
        comments=assess_comments(["nice"] * 15 + ["🔥"] * 5 + ["wow"] * 5),
    )
    result = score(s)
    assert result.level == "low"
    assert result.score is not None and result.score < 40


def test_too_little_data_is_not_scored():
    result = score(AudienceSample("instagram", 1_000, [ContentItem(likes=5)]))
    assert result.score is None
    assert result.level == "insufficient"


def test_levels_never_say_fake():
    for s in (
        AudienceSample("instagram", 300_000, ig_items(likes=900, comments=1, views=1_000)),
        AudienceSample("instagram", 40_000, ig_items()),
    ):
        result = score(s)
        assert result.level in {"high", "medium", "low", "insufficient"}
        for sig in result.signals:
            assert "fake" not in sig.label.lower()


# ------------------------------------------------------------ integration ----

def _fake_ig_scrape(followers=40_000):
    async def fake(username):
        posts = [{
            "shortcode": "PINNED", "likes": 250_000, "comments": 9_000, "is_video": False,
            "views": None, "caption": "old viral post", "posted_at": "2025-01-01T10:00:00Z",
            "is_pinned": True,
        }] + [{
            "shortcode": f"P{i}", "likes": 1_500, "comments": 40, "is_video": i % 2 == 0,
            "views": 12_000 if i % 2 == 0 else None, "caption": "",
            "posted_at": f"2026-10-0{1 + i % 5}T10:00:00Z", "is_pinned": False,
        } for i in range(10)]
        return {
            "profile": {
                "username": username, "full_name": "N", "bio": "", "profile_picture": "",
                "followers": followers, "following": 10, "posts_count": 11, "is_verified": False,
            },
            "posts": posts,
            "comment_texts": ["SECRET-COMMENT-TEXT loved this recipe"] * 3
                             + [f"genuine question {i}" for i in range(20)],
        }
    return fake


async def _import_instagram(session_factory, monkeypatch, user_id, followers=40_000):
    monkeypatch.setattr("app.modules.instagram.services.instagram_scrapper.AsyncSessionLocal", session_factory)
    monkeypatch.setattr("app.modules.instagram.services.instagram_scrapper.scrape_instagram",
                        _fake_ig_scrape(followers))
    from app.modules.instagram.services.instagram_scrapper import scrape_and_store
    return await scrape_and_store(user_id)


async def test_import_scores_the_creator_and_never_stores_comment_text(session_factory, monkeypatch):
    from app.modules.authenticity.models import AudienceSnapshot, AuthenticityReport

    user = await make_user(session_factory, "scored@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, instagram_username="scored")
    assert (await _import_instagram(session_factory, monkeypatch, user.id))["status"] == "success"

    async with session_factory() as db:
        report = (await db.execute(select(AuthenticityReport).where(AuthenticityReport.user_id == user.id))).scalar()
        snaps = (await db.execute(select(AudienceSnapshot).where(AudienceSnapshot.user_id == user.id))).scalars().all()

    assert report is not None and report.platform == "instagram"
    assert report.score is not None and report.level in {"high", "medium"}
    assert report.comment_sample == {"total": 23, "low_effort": 0, "generic": 0, "duplicates": 2}
    assert "SECRET-COMMENT-TEXT" not in str(report.signals) + str(report.comment_sample)
    assert [s.audience for s in snaps] == [40_000]


async def test_pinned_posts_are_excluded_from_analytics_and_scoring(client, session_factory, monkeypatch):
    from app.modules.authenticity.models import AuthenticityReport

    user = await make_user(session_factory, "pinned@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, instagram_username="pinned")
    await _import_instagram(session_factory, monkeypatch, user.id)

    res = await client.get(f"/instagram/analytics/{user.id}", headers=auth_header(user))
    shortcodes = [p.get("shortcode") for p in res.json()["posts"]]
    assert "PINNED" not in shortcodes and len(shortcodes) == 10

    async with session_factory() as db:
        report = (await db.execute(select(AuthenticityReport).where(AuthenticityReport.user_id == user.id))).scalar()
    # The 250K-like pinned post would have tripped the consistency check.
    consistency = next(s for s in report.signals if s["key"] == "consistency")
    assert consistency["status"] == "good"


async def test_ai_payload_uses_only_the_latest_snapshot(session_factory):
    """The 'sometimes old data' bug: the AI saw stale like counts from older snapshots."""
    from app.modules.ai.router import _build_creator_payloads
    from app.modules.instagram.models.instagram import InstagramPost, InstagramProfile
    from app.modules.users.models import CreatorProfile

    user = await make_user(session_factory, "fresh@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, instagram_username="fresh")
    old, new = datetime(2026, 9, 1), datetime(2026, 10, 1)

    async with session_factory() as db:
        for at, likes in ((old, 100), (new, 900)):
            db.add(InstagramProfile(user_id=user.id, username="fresh", followers=10_000, scraped_at=at))
            for i in range(3):
                db.add(InstagramPost(user_id=user.id, shortcode=f"S{i}", likes=likes, comments=10,
                                     posted_at=datetime(2026, 8, 20 + i), scraped_at=at))
        # A newer post in the OLD snapshot used to win on posted_at ordering.
        db.add(InstagramPost(user_id=user.id, shortcode="X", likes=1, comments=0,
                             posted_at=datetime(2026, 9, 30), scraped_at=old))
        await db.commit()
        creators = list((await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == user.id))).scalars())
        payloads = await _build_creator_payloads(creators, db)

    ig = next(p for p in payloads[user.id]["platforms"] if p["platform"] == "instagram")
    assert ig["engagement"]["avg_likes"] == 900
    assert all(post["likes"] == 900 for post in ig["recent_posts"])


async def test_report_access_rules(client, session_factory, monkeypatch):
    creator = await make_user(session_factory, "owner-a@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, instagram_username="owner")
    await _import_instagram(session_factory, monkeypatch, creator.id)
    other = await make_user(session_factory, "other-b@example.com", "INFLUENCER")
    brand = await make_user(session_factory, "brand-c@example.com", "BRAND")

    own = await client.get(f"/authenticity/{creator.id}", headers=auth_header(creator))
    assert own.status_code == 200
    body = own.json()
    assert body["reports"][0]["platform"] == "instagram"
    assert "estimate" in body["disclaimer"]

    assert (await client.get(f"/authenticity/{creator.id}", headers=auth_header(brand))).status_code == 200
    assert (await client.get(f"/authenticity/{creator.id}", headers=auth_header(other))).status_code == 403
    assert (await client.get(f"/authenticity/{creator.id}")).status_code == 401


async def test_saved_creators_carry_the_authenticity_headline(client, session_factory, monkeypatch):
    from app.modules.users.models import SavedCreator

    creator = await make_user(session_factory, "saved-a@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, instagram_username="saved")
    await _import_instagram(session_factory, monkeypatch, creator.id)
    brand = await make_user(session_factory, "saved-brand@example.com", "BRAND")
    async with session_factory() as db:
        db.add(SavedCreator(brand_id=brand.id, creator_id=creator.id, fit_level="High", score_reasoning="[]"))
        await db.commit()

    res = await client.get("/users/saved-creators", headers=auth_header(brand))
    headline = res.json()[0]["authenticity"]
    assert headline["platform"] == "instagram"
    assert headline["level"] in {"high", "medium"}
    assert isinstance(headline["highlights"], list)
