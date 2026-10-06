"""
Numbers computed in code for the AI payloads (V3 Phase 2).

The model is good at judging fit and explaining it; it is unreliable at
arithmetic and has no idea what "normal" engagement looks like for an account
of a given size in India. So every number it reasons over is computed here,
with its benchmark beside it, and the model is left to do the judgement.

Benchmarks are shared with the Authenticity Score (authenticity/scoring.py),
so the AI and the score can never disagree about what "typical" means.
"""

from __future__ import annotations

from datetime import datetime

from app.modules.authenticity.scoring import YT_ENGAGEMENT_BENCHMARK, ig_benchmark


def follower_tier(n: int | None) -> str | None:
    if not n:
        return None
    if n < 10_000:
        return "nano (under 10K)"
    if n < 50_000:
        return "micro (10K–50K)"
    if n < 500_000:
        return "mid (50K–500K)"
    if n < 1_000_000:
        return "macro (500K–1M)"
    return "mega (1M+)"


def compare_to_typical(rate: float, typical: float) -> str:
    ratio = rate / typical if typical else 0
    if ratio >= 1.5:
        return "well above typical"
    if ratio >= 0.8:
        return "in line with typical"
    if ratio >= 0.4:
        return "below typical"
    return "far below typical"


def data_age_days(scraped_at: datetime | None, now: datetime | None = None) -> int | None:
    if scraped_at is None:
        return None
    return max(0, ((now or datetime.utcnow()) - scraped_at).days)


def instagram_metrics(followers: int | None, posts: list, scraped_at: datetime | None) -> dict:
    """posts: objects with likes, comments, views, is_video (pinned already excluded)."""
    out: dict = {"follower_tier": follower_tier(followers), "data_age_days": data_age_days(scraped_at)}
    if not followers or not posts:
        return out
    rate = sum(((p.likes or 0) + (p.comments or 0)) / followers for p in posts) / len(posts)
    typical = ig_benchmark(followers)
    out.update({
        "engagement_rate_pct": round(rate * 100, 2),
        "typical_engagement_for_size_pct": round(typical * 100, 2),
        "engagement_vs_typical": compare_to_typical(rate, typical),
        "posts_analysed": len(posts),
    })
    reel_views = [p.views for p in posts if p.is_video and p.views]
    if reel_views:
        avg = sum(reel_views) / len(reel_views)
        out["avg_reel_views"] = int(avg)
        out["reel_views_as_pct_of_followers"] = round(avg / followers * 100, 1)
    return out


def youtube_metrics(subscribers: int | None, videos: list, scraped_at: datetime | None) -> dict:
    out: dict = {"subscriber_tier": follower_tier(subscribers), "data_age_days": data_age_days(scraped_at)}
    viewed = [v for v in videos if v.views]
    if not viewed:
        return out
    views = sum(v.views for v in viewed)
    rate = sum((v.likes or 0) + (v.comments or 0) for v in viewed) / views
    avg_views = views / len(viewed)
    out.update({
        "avg_views_recent": int(avg_views),
        "engagement_per_view_pct": round(rate * 100, 2),
        "typical_engagement_per_view_pct": round(YT_ENGAGEMENT_BENCHMARK * 100, 1),
        "engagement_vs_typical": compare_to_typical(rate, YT_ENGAGEMENT_BENCHMARK),
        "videos_analysed": len(viewed),
    })
    if subscribers:
        out["views_as_pct_of_subscribers"] = round(avg_views / subscribers * 100, 1)
    return out


def authenticity_for_model(reports: list) -> dict | None:
    """
    The Authenticity Score as the model sees it: the score per platform plus
    the concerns behind it. Good checks are left out — the model needs to know
    what to weigh against a creator, not a list of reassurances.
    """
    if not reports:
        return None
    out = {}
    for r in reports:
        concerns = [s["detail"] for s in (r.signals or []) if s.get("status") in ("bad", "warn")]
        out[r.platform] = {"score": r.score, "level": r.level, "concerns": concerns}
    return out
