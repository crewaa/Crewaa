"""
Tests for the Apify client boundary.

**This file exists because of an outage.** On 2026-09-30 production Instagram
imports failed for every user with:

    Instagram scraper failed for user 39: Scraping error: 'Run' object is not
    subscriptable

`apify-client` was unpinned. Version 3 changed `actor.call()` from returning a
`dict` to returning a `Run` pydantic model, a Render redeploy picked up the new
major, and `run["defaultDatasetId"]` stopped working. Apify kept running the
actor successfully — and charging for it — while we threw the results away.

Nothing caught it: `tests/test_scraping.py` mocks `scrape_instagram_creator`,
so the client wrapper underneath it had no coverage at all. This is the Apify
equivalent of `test_gemini_client.py`, which exists for exactly the same reason
on the Gemini side.

The fakes below are shaped like the real SDK rather than like our code, so a
future SDK change fails here instead of in production.
"""

import time

import pytest

from app.core.config import settings
from app.modules.instagram.services import apify_client as mod
from app.modules.instagram.services.apify_client import (
    _dataset_id, _scrape_instagram_creator_sync,
)
from app.modules.scraping.errors import (
    ProfileNotFoundError, ScrapeConfigurationError, ScrapeUpstreamError,
)

PROFILE = {
    "username": "aaravfits",
    "fullName": "Aarav Mehta",
    "biography": "Strength coach.",
    "followersCount": 142500,
    "followsCount": 480,
    "postsCount": 210,
    "verified": True,
    "latestPosts": [
        {"shortCode": "abc", "likesCount": 6900, "commentsCount": 240, "type": "Video"}
    ],
}


class RunV3:
    """
    `apify-client` 3.x returns a pydantic model. The important property for
    this regression is that it is **not subscriptable** — indexing it raises,
    which is precisely what took production down.
    """

    def __init__(self, dataset_id="ds-123"):
        self.default_dataset_id = dataset_id

    def __getitem__(self, key):
        raise TypeError("'Run' object is not subscriptable")


class _FakeDataset:
    def __init__(self, items):
        self._items = items

    def iterate_items(self):
        # Still `Iterator[dict]` in 3.x — verified against the installed SDK.
        return iter(self._items)


class _FakeActor:
    def __init__(self, run, recorder, delay=0.0):
        self._run = run
        self._recorder = recorder
        self._delay = delay

    def call(self, run_input=None, **kwargs):
        self._recorder["run_input"] = run_input
        if self._delay:
            # Real actor runs take tens of seconds. A zero-duration fake cannot
            # distinguish "ran on a thread" from "blocked the loop", because
            # there is no window in which anything else could have run.
            time.sleep(self._delay)
        return self._run


class _FakeClient:
    def __init__(self, run, items, recorder, delay=0.0):
        self._run, self._items, self._recorder = run, items, recorder
        self._delay = delay

    def actor(self, actor_id):
        self._recorder["actor_id"] = actor_id
        return _FakeActor(self._run, self._recorder, self._delay)

    def dataset(self, dataset_id):
        self._recorder["dataset_id"] = dataset_id
        return _FakeDataset(self._items)


@pytest.fixture
def apify(monkeypatch):
    """Build the client wrapper against a fake SDK, with a token configured."""
    monkeypatch.setattr(settings, "apify_token", "test-token")
    recorder: dict = {}

    def build(run, items=(PROFILE,), delay=0.0):
        monkeypatch.setattr(
            mod, "ApifyClient",
            lambda token: _FakeClient(run, list(items), recorder, delay),
        )
        return recorder

    return build


# ---------------------------------------------------------------------------
# The regression itself
# ---------------------------------------------------------------------------

def test_a_run_object_that_cannot_be_indexed_still_works(apify):
    """
    The exact production failure. If this regresses, Instagram imports break
    again while Apify quietly bills for every attempt.
    """
    recorder = apify(RunV3("ds-abc"))

    result = _scrape_instagram_creator_sync("aaravfits")

    assert result["username"] == "aaravfits"
    assert recorder["dataset_id"] == "ds-abc"


def test_the_old_dict_shape_still_works(apify):
    """
    apify-client 2.x returned a plain dict, and pip still resolves to 2.5.1 on
    Python 3.10. Supporting both means the deployed image and a developer's
    machine cannot disagree about whether imports work.
    """
    apify({"defaultDatasetId": "ds-legacy"})

    assert _scrape_instagram_creator_sync("aaravfits")["username"] == "aaravfits"


@pytest.mark.parametrize("run,expected", [
    (RunV3("ds-1"), "ds-1"),
    ({"defaultDatasetId": "ds-2"}, "ds-2"),
])
def test_dataset_id_reads_both_shapes(run, expected):
    assert _dataset_id(run) == expected


def test_an_unknown_response_shape_is_named_as_our_problem():
    """
    A third shape should say what it was and point at the SDK — not surface as
    a bare AttributeError three layers up, and never be blamed on the creator.
    """
    class SomethingElse:
        pass

    with pytest.raises(ScrapeConfigurationError) as excinfo:
        _dataset_id(SomethingElse())

    assert "SomethingElse" in str(excinfo.value)
    assert "apify-client" in str(excinfo.value)


def test_no_run_at_all_is_an_upstream_failure():
    """`call()` is typed `Run | None`; None means the run never started."""
    with pytest.raises(ScrapeUpstreamError):
        _dataset_id(None)


# ---------------------------------------------------------------------------
# Classification — our fault versus the creator's
# ---------------------------------------------------------------------------

def test_a_missing_token_is_a_configuration_error(monkeypatch):
    """
    It used to raise ValueError, which the layer above relabelled as "Creator
    not found" — sending anyone debugging it to look at the wrong thing.
    """
    monkeypatch.setattr(settings, "apify_token", "")

    with pytest.raises(ScrapeConfigurationError, match="APIFY_TOKEN"):
        _scrape_instagram_creator_sync("aaravfits")


def test_an_empty_dataset_is_a_missing_profile(apify):
    """The actor ran fine and found nothing. This one really is the account."""
    apify(RunV3(), items=[])

    with pytest.raises(ProfileNotFoundError, match="aaravfits"):
        _scrape_instagram_creator_sync("aaravfits")


# ---------------------------------------------------------------------------
# What we actually send Apify
# ---------------------------------------------------------------------------

def test_the_actor_and_input_match_what_apify_expects(apify):
    """
    `usernames` is still the documented input key for
    apify/instagram-profile-scraper. Asserting it here means a rename is caught
    by a test rather than by a user.
    """
    recorder = apify(RunV3())

    _scrape_instagram_creator_sync("aaravfits")

    assert recorder["actor_id"] == "apify/instagram-profile-scraper"
    assert recorder["run_input"]["usernames"] == ["aaravfits"]
    assert recorder["run_input"]["proxy"] == {"useApifyProxy": True}


async def test_the_async_wrapper_does_not_block_the_event_loop(apify):
    """
    The scrape runs on the event loop inside a background task; without the
    threadpool hop a 30-60s actor run stalls every other request on the worker.
    """
    import asyncio

    # 80ms of genuinely blocking work, so a loop that froze would tick zero
    # times and one that stayed free ticks several.
    apify(RunV3(), delay=0.08)
    ticks = 0

    async def heartbeat():
        nonlocal ticks
        while True:
            await asyncio.sleep(0.005)
            ticks += 1

    beat = asyncio.create_task(heartbeat())
    await asyncio.sleep(0.02)
    ticks = 0

    await mod.scrape_instagram_creator("aaravfits")
    beat.cancel()

    assert ticks > 0, "the Apify call blocked the event loop"


# ---------------------------------------------------------------------------
# What the creator is actually told
# ---------------------------------------------------------------------------

async def test_our_own_failure_is_not_blamed_on_the_creators_account(
    session_factory, monkeypatch
):
    """
    The heart of the 2026-09-30 incident. A parsing bug on our side was
    reported as "the account may be private, renamed, or Instagram may be
    rate-limiting us", which is both untrue and impossible for a creator to act
    on — and it sent the investigation at Instagram instead of at our code.
    """
    from app.modules.instagram.services import instagram_scrapper as svc
    from app.modules.scraping.models import ScrapeJob
    from sqlalchemy import select
    from tests.conftest import make_creator_profile, make_user

    user = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, instagram_username="aaravfits")
    monkeypatch.setattr(svc, "AsyncSessionLocal", session_factory)

    async def boom(username):
        raise ScrapeConfigurationError("APIFY_TOKEN is not configured")

    monkeypatch.setattr(svc, "scrape_instagram", boom)

    await svc.scrape_and_store(user.id)

    async with session_factory() as db:
        job = (await db.execute(select(ScrapeJob))).scalar()

    message = job.message.lower()
    assert "our side" in message, f"our bug still blamed on the creator: {job.message}"
    assert "private" not in message
    assert "rate-limiting" not in message
    # And never leak the internals that caused it.
    assert "apify_token" not in message


async def test_a_genuinely_unreadable_account_still_says_so(
    session_factory, monkeypatch
):
    """The opposite case must keep working — this one IS the creator's to fix."""
    from app.modules.instagram.services import instagram_scrapper as svc
    from app.modules.scraping.models import ScrapeJob
    from sqlalchemy import select
    from tests.conftest import make_creator_profile, make_user

    user = await make_user(session_factory, "c2@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id, instagram_username="ghost")
    monkeypatch.setattr(svc, "AsyncSessionLocal", session_factory)

    async def missing(username):
        raise ProfileNotFoundError("Creator 'ghost' not found on Instagram")

    monkeypatch.setattr(svc, "scrape_instagram", missing)

    await svc.scrape_and_store(user.id)

    async with session_factory() as db:
        job = (await db.execute(select(ScrapeJob))).scalar()

    assert "@ghost" in job.message
    assert "public" in job.message.lower()
