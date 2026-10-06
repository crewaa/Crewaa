"""
Authenticity Score — an *estimate* of how real a creator's audience and
engagement are, from public data only.

Why an estimate: follower lists are not public, so nobody (HypeAuditor
included) can count fake followers exactly. What can be measured is whether the
numbers behave the way real audiences behave. Each check below is one such
pattern; none of them alone proves anything, which is why the output is a
weighted score with reasons, never a verdict.

Product rules (VERSION-3-PLAN.md §4):
  * Shown to brands as an estimate, with the reasons visible.
  * Never labelled "fake" anywhere — levels are high / medium / low.
  * A check without enough data is reported as unknown and left out of the
    score, rather than guessed.

Benchmarks (checked 2026-10-06):
  * Instagram engagement by follower tier, India-focused 2025 data (Qoruz):
    nano 1K–10K 6.0%, micro 10K–50K 3.5%, mid 50K–500K 2.5%,
    macro 500K–1M 1.5%, 1M+ 0.8%.
  * YouTube (likes+comments)/views: ~3% normal, 5% strong, 7% exceptional,
    and it barely varies with channel size (Overseer, 2,251 videos).
Thresholds that are not from those sources (likes:comments ratio, reach, growth
spikes, consistency) are deliberately conservative heuristics and are marked as
such. Pure functions only: no database, no network — see tests/test_authenticity.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from statistics import median

from app.modules.authenticity.comments import CommentQuality

GOOD, WARN, BAD, UNKNOWN = "good", "warn", "bad", "unknown"

#: How much each check counts. Engagement and growth are the strongest tells.
WEIGHTS = {
    "engagement": 30,
    "growth": 20,
    "likes_comments": 15,
    "reach": 15,
    "consistency": 10,
    "comments": 10,
}

#: Below this much known weight there is not enough evidence to score at all.
MIN_KNOWN_WEIGHT = 45

#: Instagram engagement benchmarks: (upper follower bound, expected rate).
IG_ENGAGEMENT_TIERS = [
    (10_000, 0.060),
    (50_000, 0.035),
    (500_000, 0.025),
    (1_000_000, 0.015),
    (float("inf"), 0.008),
]
YT_ENGAGEMENT_BENCHMARK = 0.03


@dataclass
class ContentItem:
    likes: int = 0
    comments: int = 0
    views: int | None = None
    is_video: bool = False


@dataclass
class AudienceSample:
    platform: str  # "instagram" | "youtube"
    audience: int  # followers or subscribers
    items: list[ContentItem] = field(default_factory=list)
    #: (when, audience size), any order
    history: list[tuple[datetime, int]] = field(default_factory=list)
    comments: CommentQuality | None = None


@dataclass
class Signal:
    key: str
    label: str
    status: str
    value: str | None
    detail: str

    def as_dict(self) -> dict:
        return {
            "key": self.key, "label": self.label, "status": self.status,
            "value": self.value, "detail": self.detail,
        }


@dataclass
class AuthenticityResult:
    score: int | None
    level: str  # "high" | "medium" | "low" | "insufficient"
    signals: list[Signal]

    def as_dict(self) -> dict:
        return {"score": self.score, "level": self.level, "signals": [s.as_dict() for s in self.signals]}


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%" if x < 0.1 else f"{x * 100:.0f}%"


def ig_benchmark(followers: int) -> float:
    for bound, rate in IG_ENGAGEMENT_TIERS:
        if followers < bound:
            return rate
    return IG_ENGAGEMENT_TIERS[-1][1]


# ---------------------------------------------------------------- checks ----

def check_engagement(s: AudienceSample) -> Signal:
    label = "Engagement for their size"
    items = s.items
    if s.audience <= 0 or len(items) < 3:
        return Signal("engagement", label, UNKNOWN, None, "Needs at least three recent posts.")

    if s.platform == "instagram":
        rate = sum((i.likes + i.comments) / s.audience for i in items) / len(items)
        bench = ig_benchmark(s.audience)
        ratio = rate / bench
        value = f"{_pct(rate)} vs {_pct(bench)} typical"
        if ratio < 0.15:
            return Signal("engagement", label, BAD, value,
                          "Far fewer people engage than usual for an account this size — a common sign of inactive or bought followers.")
        if ratio < 0.4:
            return Signal("engagement", label, WARN, value, "Engagement is below normal for an account this size.")
        if ratio > 6:
            return Signal("engagement", label, WARN, value,
                          "Engagement is unusually high for this size. Often genuine, but it can also mean engagement groups or bought likes.")
        return Signal("engagement", label, GOOD, value, "Engagement is in the normal range for an account this size.")

    views = sum(i.views or 0 for i in items)
    if views <= 0:
        return Signal("engagement", label, UNKNOWN, None, "No view counts on recent videos.")
    rate = sum(i.likes + i.comments for i in items) / views
    value = f"{_pct(rate)} of viewers vs ~3% typical"
    if rate < 0.005:
        return Signal("engagement", label, BAD, value,
                      "Very few viewers like or comment — a common sign of bought views.")
    if rate < 0.012:
        return Signal("engagement", label, WARN, value, "Viewers engage less than usual.")
    if rate > 0.20:
        return Signal("engagement", label, WARN, value, "Engagement per view is unusually high. Worth a closer look.")
    return Signal("engagement", label, GOOD, value, "Viewers engage at a normal rate.")


def check_likes_comments(s: AudienceSample) -> Signal:
    """Heuristic. Bought likes are cheap; bought comments are rarer, so a huge ratio stands out."""
    label = "Likes compared with comments"
    likes = sum(i.likes for i in s.items)
    comments = sum(i.comments for i in s.items)
    if len(s.items) < 3 or likes < 50:
        return Signal("likes_comments", label, UNKNOWN, None, "Not enough likes yet to compare.")
    ratio = likes / max(comments, 1)
    value = f"{ratio:,.0f} likes per comment"
    bad_at, warn_at = (500, 200) if s.platform == "instagram" else (400, 150)
    if ratio >= bad_at:
        return Signal("likes_comments", label, BAD, value,
                      "Likes vastly outnumber comments — a common pattern when likes are bought.")
    if ratio >= warn_at:
        return Signal("likes_comments", label, WARN, value, "Likes are high relative to comments.")
    if ratio < 3:
        return Signal("likes_comments", label, WARN, value,
                      "Almost as many comments as likes — common with giveaways or comment groups.")
    return Signal("likes_comments", label, GOOD, value, "Likes and comments are in a natural balance.")


def check_reach(s: AudienceSample) -> Signal:
    """Heuristic. Real audiences watch; inactive or bought ones don't."""
    who = "followers" if s.platform == "instagram" else "subscribers"
    label = f"Views compared with {who}"
    if s.platform == "instagram":
        viewed = [i.views for i in s.items if i.is_video and i.views]
        need = 2
    else:
        viewed = [i.views for i in s.items if i.views is not None]
        need = 3
    if s.audience <= 0 or len(viewed) < need:
        return Signal("reach", label, UNKNOWN, None, f"Needs at least {need} recent videos with view counts.")
    share = (sum(viewed) / len(viewed)) / s.audience
    value = f"average views = {_pct(share)} of {who}"
    if s.platform == "instagram":
        bad_at, warn_at = 0.01, 0.03
    else:
        bad_at, warn_at = 0.005, 0.02
    if share < bad_at:
        return Signal("reach", label, BAD, value,
                      f"Very few of their {who} watch new videos — often a sign the audience is inactive or not real.")
    if share < warn_at:
        return Signal("reach", label, WARN, value, f"Only a small share of {who} watch new videos.")
    return Signal("reach", label, GOOD, value, f"A healthy share of {who} watch new videos.")


def check_growth(s: AudienceSample) -> Signal:
    """Heuristic. Bought followers arrive in jumps; platforms remove them in sweeps."""
    who = "Follower" if s.platform == "instagram" else "Subscriber"
    label = f"{who} growth"
    points = sorted((t, n) for t, n in s.history if n and n > 0)
    if len(points) < 2 or (points[-1][0] - points[0][0]).days < 3:
        return Signal("growth", label, UNKNOWN, None,
                      "We need imports a few days apart to see growth. This fills in automatically over time.")

    worst_gain = worst_drop = 0.0
    for (t1, n1), (t2, n2) in zip(points, points[1:]):
        days = max((t2 - t1).total_seconds() / 86400, 0.5)
        change = (n2 - n1) / n1
        if days <= 7 and abs(n2 - n1) >= 500:
            worst_gain = max(worst_gain, change)
            worst_drop = min(worst_drop, change)

    span = (points[-1][0] - points[0][0]).days
    if worst_gain >= 0.10:
        return Signal("growth", label, BAD, f"+{_pct(worst_gain)} within a week",
                      f"{who}s jumped sharply in a short time — the usual pattern when followers are bought.")
    if worst_gain >= 0.04:
        return Signal("growth", label, WARN, f"+{_pct(worst_gain)} within a week",
                      f"A fast jump in {who.lower()}s. Could be a viral post; worth checking.")
    if worst_drop <= -0.10:
        return Signal("growth", label, WARN, f"{_pct(worst_drop)} within a week",
                      f"A sharp drop in {who.lower()}s — platforms remove fake accounts in sweeps.")
    return Signal("growth", label, GOOD, f"steady over {span} days", f"{who} numbers change gradually, as real audiences do.")


def check_consistency(s: AudienceSample) -> Signal:
    """Heuristic, warn-only: one viral post is normal, so this never scores as bad."""
    label = "Consistency across posts"
    metric = [i.likes for i in s.items] if s.platform == "instagram" else [i.views or 0 for i in s.items]
    metric = [m for m in metric if m is not None]
    if len(metric) < 5:
        return Signal("consistency", label, UNKNOWN, None, "Needs at least five recent posts.")
    mid = median(metric)
    if mid <= 0:
        return Signal("consistency", label, UNKNOWN, None, "Not enough engagement to compare posts.")
    spread = max(metric) / mid
    limit = 15 if s.platform == "instagram" else 30
    value = f"top post = {spread:.0f}× the typical post"
    if spread > limit:
        return Signal("consistency", label, WARN, value,
                      "One post far outperforms the rest. Often a viral hit, sometimes boosted engagement.")
    return Signal("consistency", label, GOOD, value, "Engagement is fairly even from post to post.")


def check_comments(s: AudienceSample) -> Signal:
    label = "Comment quality"
    q = s.comments
    if q is None or q.total < 15:
        return Signal("comments", label, UNKNOWN, None, "Not enough recent comments to judge.")
    share = q.suspicious_share or 0.0
    value = f"{_pct(share)} generic or repeated"
    if share >= 0.6:
        return Signal("comments", label, BAD, value,
                      "Most comments are generic or copy-pasted — a common sign of bot comments.")
    if share >= 0.35:
        return Signal("comments", label, WARN, value, "Many comments are generic or repeated.")
    return Signal("comments", label, GOOD, value, "Comments read like real conversation.")


CHECKS = [check_engagement, check_growth, check_likes_comments, check_reach, check_consistency, check_comments]


def score(sample: AudienceSample) -> AuthenticityResult:
    signals = [check(sample) for check in CHECKS]
    known = [sig for sig in signals if sig.status != UNKNOWN]
    known_weight = sum(WEIGHTS[sig.key] for sig in known)

    if known_weight < MIN_KNOWN_WEIGHT:
        return AuthenticityResult(None, "insufficient", signals)

    penalty = sum(WEIGHTS[sig.key] * (1.0 if sig.status == BAD else 0.5 if sig.status == WARN else 0.0)
                  for sig in known)
    value = round(100 * (1 - penalty / known_weight))
    level = "high" if value >= 80 else "medium" if value >= 60 else "low"
    return AuthenticityResult(value, level, signals)
