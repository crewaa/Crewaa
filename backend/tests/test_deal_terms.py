"""
Tests for deal terms (V2 §1.2).

This is the first object in Crewaa with real money attached, so the properties
that matter are not "does the happy path work" but:

* nobody can manufacture an agreement the other side never saw,
* an accepted record can never change afterwards,
* the negotiation history survives a counter,
* and a third party cannot see or touch any of it.
"""

import asyncio
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.deals.offers import DealOffer, OfferStatus
from tests.conftest import auth_header, make_brand_profile, make_creator_profile, make_user

OPPORTUNITY_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

OFFER = {
    "fee": "30000.00",
    "currency": "INR",
    "deliverables": ["1x Reel (45s)", "2x Story frames"],
    "deadline": "2026-11-15",
    "note": "Filmed during a normal training session.",
}


async def _seed(session_factory, status: str = InterestStatus.INTERESTED):
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    await make_brand_profile(session_factory, brand.id, brand_name="NutriFlex")
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


async def _propose(client, user, interest_id, **overrides):
    payload = {**OFFER, **overrides}
    return await client.post(
        f"/deals/{interest_id}/terms", json=payload, headers=auth_header(user)
    )


# ---------------------------------------------------------------------------
# Who can see and touch a negotiation
# ---------------------------------------------------------------------------

async def test_a_third_party_cannot_read_the_terms(client, session_factory):
    _, _, interest = await _seed(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "BRAND")

    res = await client.get(f"/deals/{interest.id}/terms", headers=auth_header(outsider))

    # 404, not 403 — the existence of someone else's deal is not disclosed.
    assert res.status_code == 404


async def test_a_third_party_cannot_propose_terms(client, session_factory):
    _, _, interest = await _seed(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "BRAND")

    assert (await _propose(client, outsider, interest.id)).status_code == 404


async def test_both_parties_can_read_the_terms(client, session_factory):
    brand, creator, interest = await _seed(session_factory)

    for user in (brand, creator):
        res = await client.get(f"/deals/{interest.id}/terms", headers=auth_header(user))
        assert res.status_code == 200
        assert res.json()["interest_id"] == interest.id


# ---------------------------------------------------------------------------
# The rule the whole state machine rests on
# ---------------------------------------------------------------------------

async def test_you_cannot_accept_your_own_offer(client, session_factory):
    """
    Without this a brand proposes and instantly 'accepts', producing a signed
    agreement the creator never saw. This is the single most important
    assertion in the file.
    """
    brand, _, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    res = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(brand)
    )

    assert res.status_code == 403
    assert "your own offer" in res.json()["detail"].lower()


async def test_you_cannot_decline_your_own_offer(client, session_factory):
    brand, _, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    res = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/decline", headers=auth_header(brand)
    )
    assert res.status_code == 403


async def test_you_cannot_withdraw_the_other_sides_offer(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    res = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/withdraw", headers=auth_header(creator)
    )

    assert res.status_code == 403
    assert "made an offer" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Negotiating
# ---------------------------------------------------------------------------

async def test_a_brand_proposes_and_a_creator_accepts(client, session_factory):
    brand, creator, interest = await _seed(session_factory)

    proposed = await _propose(client, brand, interest.id)
    assert proposed.status_code == 201
    body = proposed.json()
    assert body["current"]["fee"] == "30000.00"
    assert body["current"]["deliverables"] == ["1x Reel (45s)", "2x Story frames"]
    assert body["current"]["proposed_by_role"] == "brand"

    offer_id = body["current"]["id"]
    accepted = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(creator)
    )

    assert accepted.status_code == 200
    terms = accepted.json()
    assert terms["agreed"]["id"] == offer_id
    assert terms["agreed"]["status"] == "accepted"
    assert terms["current"] is None
    # Settled: no further moves are offered to either side.
    assert terms["can_propose"] is False
    assert terms["can_respond"] is False


async def test_a_creator_can_counter_and_the_history_survives(client, session_factory):
    """
    Countering supersedes rather than edits. If it overwrote the row, "we agreed
    ₹30,000" would be unprovable the moment someone changed their mind.
    """
    brand, creator, interest = await _seed(session_factory)

    first_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]
    countered = await _propose(client, creator, interest.id, fee="45000.00")

    assert countered.status_code == 201
    terms = countered.json()
    assert terms["current"]["fee"] == "45000.00"
    assert terms["current"]["proposed_by_role"] == "creator"
    assert terms["current"]["supersedes_id"] == first_id

    # The original is still there, marked superseded, with its number intact.
    superseded = [o for o in terms["history"] if o["id"] == first_id]
    assert len(superseded) == 1
    assert superseded[0]["status"] == "superseded"
    assert superseded[0]["fee"] == "30000.00"


async def test_you_cannot_counter_your_own_live_offer(client, session_factory):
    """Otherwise a brand could keep rewriting its offer while the creator reads it."""
    brand, _, interest = await _seed(session_factory)
    await _propose(client, brand, interest.id)

    res = await _propose(client, brand, interest.id, fee="20000.00")

    assert res.status_code == 400
    assert "withdraw" in res.json()["detail"].lower()


async def test_withdrawing_reopens_the_table(client, session_factory):
    brand, _, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    withdrawn = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/withdraw", headers=auth_header(brand)
    )

    assert withdrawn.status_code == 200
    assert withdrawn.json()["current"] is None
    assert withdrawn.json()["can_propose"] is True
    # And a fresh offer is accepted.
    assert (await _propose(client, brand, interest.id, fee="25000.00")).status_code == 201


async def test_declining_does_not_end_the_conversation(client, session_factory):
    """
    A wrong number should not kill the deal. Either side may propose again after
    a decline — ending the negotiation there would be a worse product.
    """
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    declined = await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/decline", headers=auth_header(creator)
    )

    assert declined.status_code == 200
    assert declined.json()["can_propose"] is True
    assert (await _propose(client, creator, interest.id, fee="40000.00")).status_code == 201


# ---------------------------------------------------------------------------
# Once agreed, it is agreed
# ---------------------------------------------------------------------------

async def test_no_new_terms_after_acceptance(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]
    await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(creator)
    )

    res = await _propose(client, brand, interest.id, fee="10000.00")

    assert res.status_code == 400
    assert "already agreed" in res.json()["detail"].lower()


async def test_an_accepted_offer_cannot_be_responded_to_again(client, session_factory):
    """Guards against a replayed request re-opening a settled deal."""
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]
    await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(creator)
    )

    for action in ("accept", "decline", "withdraw"):
        res = await client.post(
            f"/deals/{interest.id}/terms/{offer_id}/{action}", headers=auth_header(brand)
        )
        assert res.status_code == 409, action


async def test_the_agreed_figures_never_change(client, session_factory):
    """
    The record both sides rely on. Read straight from the database rather than
    the API, so a serialisation change cannot mask a mutated row.
    """
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]
    await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(creator)
    )

    # Everything either side can still try to do.
    await _propose(client, brand, interest.id, fee="1.00")
    await _propose(client, creator, interest.id, fee="999999.00")
    await client.post(
        f"/deals/{interest.id}/terms/{offer_id}/decline", headers=auth_header(brand)
    )

    async with session_factory() as db:
        agreed = (await db.execute(
            select(DealOffer).where(DealOffer.status == OfferStatus.ACCEPTED)
        )).scalar()

    assert agreed.id == offer_id
    assert Decimal(str(agreed.fee)) == Decimal("30000.00")


async def test_a_stale_response_is_rejected_with_a_conflict(client, session_factory):
    """
    Two tabs open: the creator counters in one, then clicks Accept in the other
    on an offer that is no longer live. A 409 tells the UI to reload instead of
    silently agreeing to superseded terms.
    """
    brand, creator, interest = await _seed(session_factory)
    stale_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]
    await _propose(client, creator, interest.id, fee="45000.00")

    res = await client.post(
        f"/deals/{interest.id}/terms/{stale_id}/accept", headers=auth_header(creator)
    )

    assert res.status_code == 409
    assert "no longer open" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Interaction with the rest of the product
# ---------------------------------------------------------------------------

async def test_a_withdrawn_interest_closes_the_negotiation(client, session_factory):
    brand, _, interest = await _seed(session_factory, status=InterestStatus.WITHDRAWN)

    res = await _propose(client, brand, interest.id)

    assert res.status_code == 400
    assert "withdrawn" in res.json()["detail"].lower()


async def test_no_commission_is_recorded_or_returned(client, session_factory):
    """
    Deliberate for this slice (V2 §1.2): Crewaa's 20-25% is not calculated until
    a deal settles in the payment phase, and the rate tier is still unresolved.
    Showing a creator a net figure derived from a guessed rate would repeat V1's
    'numbers nobody agreed to' bug. The column exists but stays null.
    """
    brand, creator, interest = await _seed(session_factory)
    body = (await _propose(client, brand, interest.id)).json()

    assert "commission" not in str(body).lower()

    async with session_factory() as db:
        offer = (await db.execute(select(DealOffer))).scalar()
    assert offer.commission_rate_pct is None


@pytest.mark.parametrize("bad_fee", ["0", "-100", "100000001"])
async def test_implausible_fees_are_rejected(client, session_factory, bad_fee):
    """A typo should not become a contract."""
    brand, _, interest = await _seed(session_factory)

    assert (await _propose(client, brand, interest.id, fee=bad_fee)).status_code == 422


async def test_simultaneous_acceptance_cannot_agree_twice(client, session_factory):
    """
    Both parties clicking at the same moment must still end with exactly one
    accepted row — two agreed prices on one deal is unresolvable later.
    """
    brand, creator, interest = await _seed(session_factory)
    offer_id = (await _propose(client, brand, interest.id)).json()["current"]["id"]

    await asyncio.gather(*[
        client.post(
            f"/deals/{interest.id}/terms/{offer_id}/accept", headers=auth_header(creator)
        )
        for _ in range(4)
    ])

    async with session_factory() as db:
        accepted = (await db.execute(
            select(DealOffer).where(DealOffer.status == OfferStatus.ACCEPTED)
        )).scalars().all()

    assert len(accepted) == 1
