"""
Comment-quality check for the Authenticity Score.

Bought engagement shows up in comments as a wall of near-identical, contentless
replies — "nice", "🔥🔥🔥", "great pic" — often repeated word for word across
posts. This module only measures that pattern; it never decides an account is
fake on its own (see scoring.py for how it is weighted).

Deliberately a deterministic heuristic, not a model call:
  * it costs nothing and runs on every scrape,
  * it is exactly testable,
  * it never sends third parties' words to an external service.
An AI pass can be layered on top in the V3 AI-engine phase.

Privacy: callers pass comment text in memory and keep only the aggregate this
returns. Comment text is other people's content and is never stored.

Indian audiences use emoji-only comments heavily and genuinely, so emoji-only
counts as "low-effort", not "suspicious", and the thresholds in scoring.py are
set with that in mind.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass

#: Generic praise that fits any post. Lower-cased, punctuation stripped.
GENERIC_PHRASES = {
    "nice", "nice pic", "nice post", "nice one", "nice video", "nice click", "nice shot",
    "great", "great pic", "great post", "great content", "great work", "great job", "great video",
    "awesome", "awesome pic", "awesome post", "amazing", "amazing pic", "amazing post",
    "wow", "wow nice", "beautiful", "beautiful pic", "lovely", "love it", "love this",
    "cool", "cool pic", "super", "superb", "good", "good one", "very nice", "so nice",
    "osm", "awsm", "mast", "best", "perfect", "fantastic", "fabulous", "gorgeous",
    "keep it up", "keep going", "well done", "first", "follow me", "follow back",
    "check my profile", "check dm", "dm me", "collab", "promote it on",
}

_WORD = re.compile(r"[a-z0-9ऀ-ॿ]+")  # latin + Devanagari letters/digits


def _is_emoji_or_symbol(ch: str) -> bool:
    cat = unicodedata.category(ch)
    return cat.startswith("S") or cat in ("Cs", "Co") or ch in "‍️"


def _normalise(text: str) -> str:
    return " ".join(_WORD.findall(text.lower()))


@dataclass(frozen=True)
class CommentQuality:
    total: int
    #: emoji/symbol-only, or empty after stripping
    low_effort: int
    #: generic praise or spam phrases
    generic: int
    #: the same text posted more than once in the sample
    duplicates: int

    @property
    def suspicious_share(self) -> float | None:
        """Share of comments that are generic or duplicated (0–1)."""
        if self.total == 0:
            return None
        return min(1.0, (self.generic + self.duplicates) / self.total)

    @property
    def low_effort_share(self) -> float | None:
        if self.total == 0:
            return None
        return self.low_effort / self.total

    def as_dict(self) -> dict:
        return {
            "total": self.total,
            "low_effort": self.low_effort,
            "generic": self.generic,
            "duplicates": self.duplicates,
        }


def assess_comments(comments: list[str]) -> CommentQuality:
    """Classify a sample of comments. Empty or non-string items are ignored."""
    texts = [c.strip() for c in comments if isinstance(c, str) and c.strip()]
    low_effort = generic = 0
    normalised: list[str] = []

    for text in texts:
        words = _normalise(text)
        if not words:
            if all(_is_emoji_or_symbol(ch) or ch.isspace() or not ch.isalnum() for ch in text):
                low_effort += 1
            continue
        normalised.append(words)
        if words in GENERIC_PHRASES:
            generic += 1

    # Repeats of the same non-trivial text (excluding the generic ones already
    # counted, so a comment is never double-penalised).
    counts = Counter(normalised)
    duplicates = sum(n - 1 for text, n in counts.items() if n > 1 and text not in GENERIC_PHRASES)

    return CommentQuality(total=len(texts), low_effort=low_effort, generic=generic, duplicates=duplicates)
