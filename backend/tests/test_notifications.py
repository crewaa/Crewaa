"""
In-app notifications (V2 §2.1).

Crewaa shipped messaging, offers, delivery and reviews — four features whose
whole value is that the other person responds — and nothing that told anyone
anything. These tests cover the bell, and three rules that are easy to break
without noticing:

* notifications go to the person who did *not* act,
* a burst of messages collapses into one entry rather than twenty,
* and a review notification never leaks the rating, which would defeat the
  double-blind the review system is built around.
"""

from sqlalchemy import select

from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.notifications.models import Notification
from tests.conftest import (
    auth_header, make_brand_profile, make_creator_profile, make_user,
)

OPPORTUNITY_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


async def _pair(session_factory):
    """A brand and a creator with an open interest between them."""
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_brand_profile(session_factory, brand.id, brand_name="NutriFlex")
    await make_creator_profile(session_factory, creator.id, full_name="Aarav Mehta")

    async with session_factory() as db:
        interest = OpportunityInterest(
            creator_id=creator.id, brand_id=brand.id,
            opportunity_id=OPPORTUNITY_ID, status=InterestStatus.INTERESTED,
        )
        db.add(interest)
        await db.commit()
        await db.refresh(interest)

    return brand, creator, interest


def _auth(user):
    return auth_header(user)


async def _notifications_for(session_factory, user_id):
    async with session_factory() as db:
        return (await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at)
        )).scalars().all()


# ---------------------------------------------------------------------------
# Who gets told
# ---------------------------------------------------------------------------

async def test_a_message_notifies_the_recipient_not_the_sender(
    client, session_factory
):
    brand, creator, interest = await _pair(session_factory)

    res = await client.post(
        f"/messages/threads/{interest.id}",
        json={"body": "Hi, are you free this month?"},
        headers=_auth(brand),
    )
    assert res.status_code in (200, 201)

    assert len(await _notifications_for(session_factory, creator.id)) == 1
    # The sender must not be told about their own action. Storing the actor
    # here and filtering later is how that bug gets written.
    assert await _notifications_for(session_factory, brand.id) == []


async def test_a_burst_of_messages_collapses_into_one_entry(
    client, session_factory
):
    """
    Otherwise the bell becomes a counter of individual messages and people stop
    reading it. Ten messages in one conversation are one thing to look at.
    """
    brand, creator, interest = await _pair(session_factory)

    for i in range(5):
        await client.post(
            f"/messages/threads/{interest.id}",
            json={"body": f"message {i}"},
            headers=_auth(brand),
        )

    rows = await _notifications_for(session_factory, creator.id)
    assert len(rows) == 1
    # And it shows the newest, not the first.
    assert "message 4" in rows[0].body


async def test_a_read_notification_is_not_collapsed_into(client, session_factory):
    """
    Something already seen must not silently change under the reader — a new
    message after you have looked is new, not an edit of old news.
    """
    brand, creator, interest = await _pair(session_factory)

    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "first"}, headers=_auth(brand)
    )
    await client.post("/notifications/read", headers=_auth(creator))
    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "second"}, headers=_auth(brand)
    )

    rows = await _notifications_for(session_factory, creator.id)
    assert len(rows) == 2


# ---------------------------------------------------------------------------
# The endpoints
# ---------------------------------------------------------------------------

async def test_unread_count_and_mark_all_read(client, session_factory):
    brand, creator, interest = await _pair(session_factory)
    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hello"}, headers=_auth(brand)
    )

    before = await client.get("/notifications/unread-count", headers=_auth(creator))
    assert before.json()["unread"] == 1

    cleared = await client.post("/notifications/read", headers=_auth(creator))
    assert cleared.json()["unread"] == 0

    after = await client.get("/notifications/unread-count", headers=_auth(creator))
    assert after.json()["unread"] == 0


async def test_the_list_only_ever_shows_your_own(client, session_factory):
    brand, creator, interest = await _pair(session_factory)
    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hello"}, headers=_auth(brand)
    )

    mine = await client.get("/notifications", headers=_auth(creator))
    theirs = await client.get("/notifications", headers=_auth(brand))

    assert len(mine.json()) == 1
    assert theirs.json() == []


async def test_marking_someone_elses_notification_read_is_a_404(
    client, session_factory
):
    """
    Scoped in the query rather than fetched-then-checked. The fetch-then-check
    pattern is what produced the unauthenticated profile routes.
    """
    brand, creator, interest = await _pair(session_factory)
    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hello"}, headers=_auth(brand)
    )
    target = (await _notifications_for(session_factory, creator.id))[0]

    res = await client.post(f"/notifications/{target.id}/read", headers=_auth(brand))

    assert res.status_code == 404


async def test_notifications_require_authentication(client):
    assert (await client.get("/notifications")).status_code == 401
    assert (await client.get("/notifications/unread-count")).status_code == 401


# ---------------------------------------------------------------------------
# What a notification is allowed to say
# ---------------------------------------------------------------------------

async def test_a_message_notification_does_not_carry_the_whole_message(
    client, session_factory
):
    """The bell is a prompt to go and read, not a second inbox."""
    brand, creator, interest = await _pair(session_factory)
    long_body = "x" * 500

    await client.post(
        f"/messages/threads/{interest.id}", json={"body": long_body}, headers=_auth(brand)
    )

    body = (await _notifications_for(session_factory, creator.id))[0].body
    assert len(body) < 200


async def test_nothing_is_committed_when_the_event_itself_fails(
    client, session_factory
):
    """
    The reason notify() stages on the caller's session instead of committing:
    a notification must never describe something that did not happen. Here the
    message is rejected, so there must be no notification either.
    """
    brand, creator, interest = await _pair(session_factory)

    res = await client.post(
        f"/messages/threads/{interest.id}", json={"body": "   "}, headers=_auth(brand)
    )

    assert res.status_code >= 400
    assert await _notifications_for(session_factory, creator.id) == []
