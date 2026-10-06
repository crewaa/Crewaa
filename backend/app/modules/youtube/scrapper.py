"""
YouTube Data API v3 scraper.

V3 Phase 1 fixes (VERSION-3-PLAN.md §4):
  * The channel used to be found with `search?q=<handle>&type=channel` — a
    *fuzzy* search that can return a different, more popular channel with a
    similar name, and costs 100 quota units per call. It is now resolved
    exactly: `channels?forHandle=` for @handles, `id=` for channel ids,
    `forUsername=` for legacy /user/ URLs (1 unit each). Search remains only as
    a last resort for free-text names, and is logged when used.
  * Failures are typed (scraping/errors.py), so our own misconfiguration is no
    longer reported to the creator as "check the handle is correct".
  * A small comment sample is read for the authenticity check (1 unit per
    video). Comment text stays in memory and is never stored.
"""

import re
from typing import Any, Dict
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.modules.scraping.errors import (
    ProfileNotFoundError, ScrapeConfigurationError, ScrapeError, ScrapeUpstreamError,
)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
VIDEO_LIMIT = 15
COMMENT_VIDEOS = 5
COMMENTS_PER_VIDEO = 20

_CHANNEL_ID = re.compile(r"^UC[\w-]{22}$")


def parse_channel_ref(raw: str) -> tuple[str, str]:
    """
    Turn whatever a creator typed into (lookup kind, value).

    Accepts "@handle", "handle", channel URLs (/@handle, /channel/UC…,
    /user/name, /c/name) and bare channel ids. Kinds: "id", "handle",
    "username", "search".
    """
    text = (raw or "").strip()
    if not text:
        raise ProfileNotFoundError("No YouTube channel given")

    if "youtube.com" in text or "youtu.be" in text:
        url = text if "://" in text else f"https://{text}"
        parts = [p for p in urlparse(url).path.split("/") if p]
        if parts:
            head = parts[0]
            if head.startswith("@"):
                return "handle", head
            if head == "channel" and len(parts) > 1:
                return "id", parts[1]
            if head == "user" and len(parts) > 1:
                return "username", parts[1]
            if head == "c" and len(parts) > 1:
                return "search", parts[1]
        raise ProfileNotFoundError(f"Could not read a channel from '{raw}'")

    if _CHANNEL_ID.match(text):
        return "id", text
    if text.startswith("@"):
        return "handle", text
    if " " in text:
        return "search", text
    # A bare word is almost always a handle typed without the @.
    return "handle", f"@{text}"


async def _get(client: httpx.AsyncClient, path: str, params: dict) -> dict:
    params = {**params, "key": settings.youtube_api_key}
    try:
        res = await client.get(f"{YOUTUBE_API_BASE}/{path}", params=params, timeout=30.0)
    except httpx.RequestError as e:
        raise ScrapeUpstreamError(f"Network error calling YouTube: {e}") from e

    if res.status_code == 400 and "API key not valid" in res.text:
        raise ScrapeConfigurationError("YOUTUBE_API_KEY is invalid")
    if res.status_code == 403 and "quotaExceeded" in res.text:
        raise ScrapeUpstreamError("YouTube API daily quota exceeded")
    if res.status_code >= 400:
        raise ScrapeUpstreamError(f"YouTube API {path} returned {res.status_code}")
    return res.json()


async def _resolve_channel(client: httpx.AsyncClient, ref: str) -> dict:
    kind, value = parse_channel_ref(ref)
    part = "snippet,statistics,contentDetails"

    if kind in ("id", "handle", "username"):
        param = {"id": "id", "handle": "forHandle", "username": "forUsername"}[kind]
        data = await _get(client, "channels", {"part": part, param: value})
        if data.get("items"):
            return data["items"][0]
        if kind != "handle":
            raise ProfileNotFoundError(f"YouTube channel '{ref}' not found")
        # Some creators type their display name without spaces; fall through.

    logger.info("YouTube channel '{}' not found by exact lookup; falling back to search", ref)
    search = await _get(client, "search", {
        "part": "snippet", "q": value.lstrip("@"), "type": "channel", "maxResults": 1,
    })
    if not search.get("items"):
        raise ProfileNotFoundError(f"YouTube channel '{ref}' not found")
    channel_id = search["items"][0]["id"]["channelId"]
    data = await _get(client, "channels", {"part": part, "id": channel_id})
    if not data.get("items"):
        raise ProfileNotFoundError(f"YouTube channel '{ref}' not found")
    return data["items"][0]


async def _comment_sample(client: httpx.AsyncClient, video_ids: list[str]) -> list[str]:
    """Top comments on a few recent videos. Best-effort: failures return what was read."""
    texts: list[str] = []
    for vid in video_ids[:COMMENT_VIDEOS]:
        try:
            data = await _get(client, "commentThreads", {
                "part": "snippet", "videoId": vid, "maxResults": COMMENTS_PER_VIDEO,
                "order": "relevance", "textFormat": "plainText",
            })
        except ScrapeError as e:
            # Comments disabled on a video is a 403; never fail the import for it.
            logger.debug("Skipping comments for video {}: {}", vid, e)
            continue
        for item in data.get("items", []):
            text = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {}).get("textOriginal")
            if isinstance(text, str):
                texts.append(text)
    return texts


async def scrape_youtube_channel(username: str) -> Dict[str, Any]:
    """
    Fetch a channel, its latest videos, and a comment sample.

    Raises the typed errors from scraping/errors.py — never a bare Exception.
    """
    if not settings.youtube_api_key:
        raise ScrapeConfigurationError("YOUTUBE_API_KEY is not configured; YouTube imports are unavailable")

    try:
        async with httpx.AsyncClient() as client:
            channel_info = await _resolve_channel(client, username)
            snippet = channel_info.get("snippet", {})
            stats = channel_info.get("statistics", {})

            channel_data = {
                "channel_id": channel_info["id"],
                "username": username,
                "title": snippet.get("title"),
                "description": snippet.get("description"),
                "profile_picture": snippet.get("thumbnails", {}).get("default", {}).get("url"),
                # Hidden subscriber counts come back absent; 0 means "unknown" here.
                "subscribers": int(stats.get("subscriberCount", 0) or 0),
                "total_views": int(stats.get("viewCount", 0) or 0),
                "total_videos": int(stats.get("videoCount", 0) or 0),
                "is_verified": "verified" in (snippet.get("description") or "").lower(),
            }

            uploads = channel_info.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            videos_data: list[dict] = []
            video_ids: list[str] = []
            if uploads:
                playlist = await _get(client, "playlistItems", {
                    "part": "snippet", "playlistId": uploads, "maxResults": VIDEO_LIMIT,
                })
                video_ids = [i["snippet"]["resourceId"]["videoId"] for i in playlist.get("items", [])]

            if video_ids:
                videos = await _get(client, "videos", {
                    "part": "snippet,statistics,contentDetails", "id": ",".join(video_ids),
                })
                for video in videos.get("items", []):
                    try:
                        vstats = video.get("statistics", {})
                        videos_data.append({
                            "video_id": video["id"],
                            "title": video["snippet"]["title"],
                            "description": video["snippet"].get("description"),
                            "thumbnail": video["snippet"].get("thumbnails", {}).get("default", {}).get("url"),
                            "views": int(vstats.get("viewCount", 0) or 0),
                            "likes": int(vstats.get("likeCount", 0) or 0),
                            "comments": int(vstats.get("commentCount", 0) or 0),
                            "duration": parse_duration(video["contentDetails"]["duration"]),
                            "published_at": video["snippet"]["publishedAt"],
                        })
                    except (KeyError, ValueError) as e:
                        logger.warning("Error parsing YouTube video: {}", e)

            comment_texts = await _comment_sample(client, video_ids)

            return {"channel": channel_data, "videos": videos_data, "comment_texts": comment_texts}

    except ScrapeError:
        raise
    except Exception as e:
        logger.exception("Unexpected YouTube scraping failure for '{}'", username)
        raise ScrapeUpstreamError(f"Unexpected YouTube scraping failure: {e}") from e


def parse_duration(duration_str: str) -> int:
    """ISO 8601 duration to seconds, e.g. PT1H23M45S -> 5025 (P1DT… handled too)."""
    match = re.match(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration_str or "")
    if not match:
        return 0
    d, h, m, s = (int(x or 0) for x in match.groups())
    return d * 86400 + h * 3600 + m * 60 + s
