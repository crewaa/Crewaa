"""
Tests for in-app messaging (V2 §1.1).

The critical properties: only the two participants of an interest can read or
write in its thread, sending is blocked once the interest is withdrawn, and —
deliberately, unlike everywhere else in the product — a creator's thread
reveals the brand's identity, because expressing interest is the opt-in that
makes a conversation with a named brand appropriate.
"""

from sqlalchemy import select

from app.modules.deals.models import InterestStatus, OpportunityInterest
from tests.conftest import auth_header, make_brand_profile, make_creator_profile, make_user

OPPORTUNITY_ID = "11111111-2222-3333-4444-555555555555"


async def _seed_interest(session_factory, status: str = InterestStatus.INTERESTED):
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    await make_brand_profile(session_factory, brand.id, brand_name="Acme Corp", industry="Fitness")
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, full_name="Aarav Mehta")

    async with session_factory() as db:
        interest = OpportunityInterest(
            creator_id=creator.id, brand_id=brand.id,
            opportunity_id=OPPORTUNITY_ID, status=status,
        )
        db.add(interest)
        await db.commit()
        await db.refresh(interest)

    return brand, creator, interest


# ---------------------------------------------------------------------------
# Ownership
# ---------------------------------------------------------------------------

async def test_a_third_party_cannot_read_the_thread(client, session_factory):
    _, _, interest = await _seed_interest(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "INFLUENCER")

    res = await client.get(f"/messages/threads/{interest.id}", headers=auth_header(outsider))
    assert res.status_code == 404


async def test_a_third_party_cannot_send_into_the_thread(client, session_factory):
    _, _, interest = await _seed_interest(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "BRAND")

    res = await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hi"}, headers=auth_header(outsider)
    )
    assert res.status_code == 404


async def test_both_participants_can_read_the_thread(client, session_factory):
    brand, creator, interest = await _seed_interest(session_factory)

    assert (await client.get(
        f"/messages/threads/{interest.id}", headers=auth_header(creator)
    )).status_code == 200
    assert (await client.get(
        f"/messages/threads/{interest.id}", headers=auth_header(brand)
    )).status_code == 200


# ---------------------------------------------------------------------------
# The anonymity reveal — deliberate, scoped to this thread only
# ---------------------------------------------------------------------------

async def test_creator_sees_the_brand_identity_in_the_thread(client, session_factory):
    _, creator, interest = await _seed_interest(session_factory)

    res = await client.get(f"/messages/threads/{interest.id}", headers=auth_header(creator))

    counterpart = res.json()["counterpart"]
    assert counterpart["name"] == "Acme Corp"
    assert counterpart["subtitle"] == "Fitness"


async def test_brand_sees_the_creator_identity_in_the_thread(client, session_factory):
    brand, _, interest = await _seed_interest(session_factory)

    res = await client.get(f"/messages/threads/{interest.id}", headers=auth_header(brand))

    counterpart = res.json()["counterpart"]
    assert counterpart["name"] == "Aarav Mehta"


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------

async def test_sending_a_message_persists_it(client, session_factory):
    _, creator, interest = await _seed_interest(session_factory)

    res = await client.post(
        f"/messages/threads/{interest.id}",
        json={"body": "Would love to collaborate!"},
        headers=auth_header(creator),
    )

    assert res.status_code == 201
    body = res.json()
    assert body["body"] == "Would love to collaborate!"
    assert body["is_mine"] is True
    assert body["sender_id"] == creator.id


async def test_sending_is_blocked_once_interest_is_withdrawn(client, session_factory):
    _, creator, interest = await _seed_interest(session_factory, status=InterestStatus.WITHDRAWN)

    res = await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hi"}, headers=auth_header(creator)
    )

    assert res.status_code == 400


async def test_an_empty_message_is_rejected(client, session_factory):
    _, creator, interest = await _seed_interest(session_factory)

    res = await client.post(
        f"/messages/threads/{interest.id}", json={"body": "   "}, headers=auth_header(creator)
    )

    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Unread counts
# ---------------------------------------------------------------------------

async def test_unread_count_increments_on_send_and_resets_on_read(client, session_factory):
    brand, creator, interest = await _seed_interest(session_factory)

    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hello"}, headers=auth_header(creator)
    )

    unread = await client.get("/messages/unread-count", headers=auth_header(brand))
    assert unread.json()["unread_count"] == 1

    await client.post(f"/messages/threads/{interest.id}/read", headers=auth_header(brand))

    unread_after = await client.get("/messages/unread-count", headers=auth_header(brand))
    assert unread_after.json()["unread_count"] == 0


async def test_marking_read_does_not_affect_the_senders_own_unread_count(
    client, session_factory
):
    """Reading a thread should never mark your own sent messages as unread-by-you."""
    _, creator, interest = await _seed_interest(session_factory)

    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hello"}, headers=auth_header(creator)
    )

    own_unread = await client.get("/messages/unread-count", headers=auth_header(creator))
    assert own_unread.json()["unread_count"] == 0


# ---------------------------------------------------------------------------
# Thread listing
# ---------------------------------------------------------------------------

async def test_thread_list_only_shows_the_users_own_threads(client, session_factory):
    _, creator, interest = await _seed_interest(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "INFLUENCER")

    await client.post(
        f"/messages/threads/{interest.id}", json={"body": "hi"}, headers=auth_header(creator)
    )

    mine = await client.get("/messages/threads", headers=auth_header(creator))
    assert len(mine.json()) == 1

    theirs = await client.get("/messages/threads", headers=auth_header(outsider))
    assert len(theirs.json()) == 0


async def test_a_thread_with_no_messages_is_not_listed(client, session_factory):
    """An interest with no conversation yet isn't a 'thread' worth showing."""
    _, creator, _ = await _seed_interest(session_factory)

    res = await client.get("/messages/threads", headers=auth_header(creator))
    assert res.json() == []
