from typing import Any

from apify_client import ApifyClient
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.logging import logger
from app.modules.scraping.errors import (
    ProfileNotFoundError, ScrapeConfigurationError, ScrapeUpstreamError,
)

ACTOR_ID = "apify/instagram-profile-scraper"


def _dataset_id(run: Any) -> str:
    """
    Pull the dataset id out of whatever `actor.call()` returned.

    `apify-client` changed this shape in version 3: `call()` used to return a
    plain `dict` and now returns a `Run` pydantic model. Reading it as a dict
    raised `'Run' object is not subscriptable`, which took production Instagram
    imports down while Apify itself was succeeding — and being charged for —
    every single run.

    Both shapes are handled rather than just the pinned one, because *which*
    version gets installed is not fully under our control: pip resolves
    `apify-client` to 3.x on Python 3.11+ and caps at 2.5.1 on 3.10, so the
    library can differ between a developer's machine and the deployed image
    without anyone choosing it. The pin in pyproject.toml is the primary
    defence; this is the belt to its braces.
    """
    if run is None:
        # `call()` is typed `Run | None`. None means the run never started.
        raise ScrapeUpstreamError("Apify did not start a run for this request")

    # apify-client 3.x — a pydantic model.
    dataset_id = getattr(run, "default_dataset_id", None)

    # apify-client 2.x — a plain dict.
    if dataset_id is None and isinstance(run, dict):
        dataset_id = run.get("defaultDatasetId")

    if not dataset_id:
        # A third shape we have never seen. Say so precisely instead of letting
        # it surface as an AttributeError a layer up.
        raise ScrapeConfigurationError(
            f"Could not read a dataset id from the Apify response "
            f"(got {type(run).__name__}). The apify-client version may have "
            f"changed its response shape again."
        )

    return dataset_id


def _scrape_instagram_creator_sync(username: str) -> dict:
    """
    Call the Apify Instagram Profile Scraper actor. Blocking.

    `.call()` waits for the actor run to finish, which takes tens of seconds.
    Do not call this directly from async code — use the async wrapper below.
    """
    if not settings.apify_token:
        raise ScrapeConfigurationError(
            "APIFY_TOKEN is not configured; Instagram scraping is unavailable"
        )

    client = ApifyClient(settings.apify_token)

    run_input = {
        "usernames": [username],
        "resultsLimit": 12,
        "proxy": {"useApifyProxy": True},
    }

    run = client.actor(ACTOR_ID).call(run_input=run_input)
    dataset_id = _dataset_id(run)

    items = list(client.dataset(dataset_id).iterate_items())

    if not items:
        # The actor ran and returned nothing: private, renamed, or not a real
        # account. This one genuinely is about the creator's profile.
        raise ProfileNotFoundError(f"Creator '{username}' not found on Instagram")

    return items[0]


async def scrape_instagram_creator(username: str) -> dict:
    """
    Async wrapper around the blocking Apify SDK call.

    The scrape runs inside a background task on the event loop; without the
    threadpool hop it stalls every other request on that worker for the whole
    actor run.
    """
    return await run_in_threadpool(_scrape_instagram_creator_sync, username)
