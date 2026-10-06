from typing import Dict, Any

from app.core.logging import logger
from app.modules.instagram.services.apify_client import scrape_instagram_creator
from app.modules.scraping.errors import ScrapeError, ScrapeUpstreamError

POST_LIMIT = 15
#: Comments kept in memory per post for the authenticity check. Never stored.
COMMENTS_PER_POST = 10


async def scrape_instagram(username: str) -> Dict[str, Any]:
    """
    Scrape Instagram profile data using Apify SDK directly.
    
    Args:
        username: Instagram username to scrape
        
    Returns:
        Dictionary with profile and posts data
        
    Raises:
        Exception: If scraping fails or profile not found
    """
    try:
        logger.info("Calling Apify for Instagram @{}", username)
        raw_data = await scrape_instagram_creator(username)
        logger.info("Apify returned data for @{}", username)
        
        # Extract relevant fields from the Apify response
        # Apify field names: followersCount, followsCount, postsCount, verified, likesCount, etc.
        profile_data = {
            "username": raw_data.get("username") or raw_data.get("id") or username,
            "full_name": raw_data.get("fullName", ""),
            "bio": raw_data.get("biography", ""),
            "profile_picture": raw_data.get("profilePicUrl", ""),
            "followers": int(raw_data.get("followersCount") or raw_data.get("followers") or 0),
            "following": int(raw_data.get("followsCount") or raw_data.get("followees") or 0),
            "posts_count": int(raw_data.get("postsCount") or 0),
            "is_verified": raw_data.get("verified", False) or raw_data.get("isVerified", False),
        }
        
        # Map posts data - Apify returns latestPosts array
        posts_data = []
        comment_texts: list[str] = []
        posts = raw_data.get("latestPosts", []) or raw_data.get("posts", [])

        if posts and isinstance(posts, list):
            for post in posts[:POST_LIMIT]:
                try:
                    # Likes can come back as -1 when the creator hides them.
                    likes = int(post.get("likesCount") or post.get("likeCount") or 0)
                    views = post.get("videoViewCount") or post.get("videoPlayCount")
                    posts_data.append({
                        "shortcode": post.get("shortCode", "") or post.get("id", ""),
                        "likes": max(likes, 0),
                        "comments": max(int(post.get("commentsCount") or 0), 0),
                        "is_video": post.get("type") == "Video" or post.get("isVideo", False),
                        "views": int(views) if views else None,
                        "caption": post.get("caption", "") or post.get("text", ""),
                        "posted_at": post.get("timestamp") or post.get("date"),
                        "is_pinned": bool(post.get("isPinned", False)),
                    })
                except (KeyError, ValueError, TypeError) as e:
                    logger.warning("Error parsing Instagram post: {}", e)
                    continue

                if post.get("isPinned"):
                    continue
                for c in (post.get("latestComments") or [])[:COMMENTS_PER_POST]:
                    if isinstance(c, dict) and isinstance(c.get("text"), str):
                        comment_texts.append(c["text"])

        return {
            "profile": profile_data,
            "posts": posts_data,
            # In memory only — see app/modules/authenticity/comments.py.
            "comment_texts": comment_texts,
        }
        
    except ScrapeError:
        # Already classified (configuration / not-found / upstream). Let it
        # through untouched: the caller decides what the user is told, and
        # flattening it here is what caused our own parsing bug to be reported
        # as "the account may be private".
        raise
    except Exception as e:
        # Anything unclassified is a fault on our side until proven otherwise.
        # Blaming Instagram by default sends the investigation the wrong way.
        logger.exception("Unexpected Instagram scraping failure for @{}", username)
        raise ScrapeUpstreamError(f"Unexpected scraping failure: {e}") from e
