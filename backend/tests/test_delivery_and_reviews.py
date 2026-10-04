"""
Tests for delivery tracking (V2 §1.4) and two-way reviews (V2 §1.5).

Together these close the loop record: campaign → interest → offer → delivery →
review. The properties that matter:

* roles are asymmetric — the creator delivers, the brand reviews, and neither
  may do the other's job, or the record stops being proof of anything;
* submissions are immutable, because "you never posted it" is settled by a
  timestamp nobody can edit;
* reviews are double-blind, because whoever goes second can otherwise retaliate;
* a hidden review is indistinguishable from one that was never written, or the
  reveal rule leaks exactly what it exists to protect.
"""

import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.deals.deliveries import DealDelivery, DeliveryStatus
from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.deals.offers import DealOffer, OfferStatus
from app.modules.deals.reviews import DealReview, REVIEW_REVEAL_DAYS
from tests.conftest import auth_header, make_brand_profile, make_creator_profile, make_user

REEL = "1x Reel (45s)"
STORY = "2x Story frames"
POST_URL = "https://instagram.com/p/abc123"


async def _agreed_deal(session_factory, deliverables=(REEL, STORY)):
    """A brand and creator with terms already agreed — the §1.4 starting point."""
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    await make_brand_profile(session_factory, brand.id, brand_name="NutriFlex")
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, full_name="Aarav Mehta")

    async with session_factory() as db:
        interest = OpportunityInterest(
            creator_id=creator.id, brand_id=brand.id,
            opportunity_id="deal-0001", status=InterestStatus.INTERESTED,
        )
        db.add(interest)
        await db.flush()
        offer = DealOffer(
            interest_id=interest.id, proposed_by_id=brand.id, proposed_by_role="brand",
            fee=30000, currency="INR",
            deliverables=json.dumps(list(deliverables)) if deliverables else None,
            status=OfferStatus.ACCEPTED,
        )
        db.add(offer)
        await db.commit()
        await db.refresh(interest)
        await db.refresh(offer)

    return brand, creator, interest, offer


async def _submit(client, creator, interest_id, label=REEL, url=POST_URL, note=None):
    return await client.post(
        f"/deals/{interest_id}/delivery",
        json={"label": label, "url": url, "note": note},
        headers=auth_header(creator),
    )


async def _approve(client, brand, interest_id, delivery_id, approve=True, feedback=None):
    return await client.post(
        f"/deals/{interest_id}/delivery/{delivery_id}/review",
        json={"approve": approve, "feedback": feedback},
        headers=auth_header(brand),
    )


async def _deliver_everything(client, brand, creator, interest_id, labels=(REEL, STORY)):
    """Fast-forward a deal to fully delivered, for the review tests."""
    for label in labels:
        res = await _submit(client, creator, interest_id, label=label)
        submission = res.json()["submissions"][0]
        await _approve(client, brand, interest_id, submission["id"])


# ---------------------------------------------------------------------------
# §1.4 — who may do what
# ---------------------------------------------------------------------------

async def test_a_brand_cannot_submit_its_own_deliverable(client, session_factory):
    """Otherwise the delivery record proves nothing about the creator's work."""
    brand, _, interest, _ = await _agreed_deal(session_factory)

    res = await _submit(client, brand, interest.id)

    assert res.status_code == 403
    assert "creator" in res.json()["detail"].lower()


async def test_a_creator_cannot_approve_their_own_delivery(client, session_factory):
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    submission = (await _submit(client, creator, interest.id)).json()["submissions"][0]

    res = await _approve(client, creator, interest.id, submission["id"])

    assert res.status_code == 403
    assert "brand" in res.json()["detail"].lower()


async def test_a_third_party_sees_nothing(client, session_factory):
    _, _, interest, _ = await _agreed_deal(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "BRAND")

    res = await client.get(f"/deals/{interest.id}/delivery", headers=auth_header(outsider))
    assert res.status_code == 404


async def test_nothing_can_be_delivered_before_terms_are_agreed(client, session_factory):
    """There is no 'what was owed' to deliver against until an offer is accepted."""
    brand = await make_user(session_factory, "b2@example.com", "BRAND")
    creator = await make_user(session_factory, "c2@example.com", "INFLUENCER")
    async with session_factory() as db:
        interest = OpportunityInterest(
            creator_id=creator.id, brand_id=brand.id, opportunity_id="no-terms",
        )
        db.add(interest)
        await db.commit()
        await db.refresh(interest)

    res = await _submit(client, creator, interest.id)

    assert res.status_code == 400
    assert "agree the terms" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# §1.4 — the delivery record
# ---------------------------------------------------------------------------

async def test_submitting_and_approving_progresses_the_deal(client, session_factory):
    brand, creator, interest, _ = await _agreed_deal(session_factory)

    submitted = await _submit(client, creator, interest.id, label=REEL)
    assert submitted.status_code == 201
    state = submitted.json()
    assert state["complete"] is False
    assert state["outstanding"] == [REEL, STORY]     # nothing approved yet

    approved = await _approve(
        client, brand, interest.id, state["submissions"][0]["id"]
    )
    assert approved.json()["outstanding"] == [STORY]
    assert approved.json()["complete"] is False

    await _deliver_everything(client, brand, creator, interest.id, labels=(STORY,))
    final = await client.get(f"/deals/{interest.id}/delivery", headers=auth_header(brand))
    assert final.json()["complete"] is True
    assert final.json()["outstanding"] == []


async def test_a_deliverable_not_in_the_agreed_list_is_rejected(client, session_factory):
    """
    Otherwise '1x Reel (45s)' could be satisfied by something called anything
    at all, and `outstanding` would never empty.
    """
    _, creator, interest, _ = await _agreed_deal(session_factory)

    res = await _submit(client, creator, interest.id, label="a tweet, honestly")

    assert res.status_code == 400
    assert "not one of the agreed deliverables" in res.json()["detail"].lower()


async def test_resubmitting_supersedes_rather_than_edits(client, session_factory):
    """The original submission and its timestamp are the evidence."""
    brand, creator, interest, offer = await _agreed_deal(session_factory)
    first = (await _submit(client, creator, interest.id, url="https://example.com/wrong")
             ).json()["submissions"][0]
    await _approve(client, brand, interest.id, first["id"], approve=False,
                   feedback="Wrong link.")

    again = await _submit(client, creator, interest.id, url="https://example.com/right")

    assert again.status_code == 201
    async with session_factory() as db:
        rows = list((await db.execute(
            select(DealDelivery).order_by(DealDelivery.id)
        )).scalars().all())

    assert len(rows) == 2, "resubmission edited the original instead of adding a row"
    assert rows[0].url == "https://example.com/wrong"   # untouched
    assert rows[0].status == DeliveryStatus.SUPERSEDED
    assert rows[1].supersedes_id == rows[0].id


async def test_changes_cannot_be_requested_without_a_reason(client, session_factory):
    """'Rejected' with no explanation gives the creator nothing to act on."""
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    submission = (await _submit(client, creator, interest.id)).json()["submissions"][0]

    res = await _approve(client, brand, interest.id, submission["id"], approve=False)

    assert res.status_code == 400
    assert "what needs changing" in res.json()["detail"].lower()


async def test_an_approved_deliverable_cannot_be_resubmitted(client, session_factory):
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    submission = (await _submit(client, creator, interest.id)).json()["submissions"][0]
    await _approve(client, brand, interest.id, submission["id"])

    res = await _submit(client, creator, interest.id)

    assert res.status_code == 400
    assert "already been approved" in res.json()["detail"].lower()


async def test_reviewing_the_same_submission_twice_conflicts(client, session_factory):
    """Stale tab, or a replayed request."""
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    submission = (await _submit(client, creator, interest.id)).json()["submissions"][0]
    await _approve(client, brand, interest.id, submission["id"])

    res = await _approve(client, brand, interest.id, submission["id"])
    assert res.status_code == 409


@pytest.mark.parametrize("bad_url", ["not-a-link", "javascript:alert(1)", "ftp://x.com/a"])
async def test_a_deliverable_must_be_an_http_link(client, session_factory, bad_url):
    _, creator, interest, _ = await _agreed_deal(session_factory)
    assert (await _submit(client, creator, interest.id, url=bad_url)).status_code == 422


async def test_a_fee_only_deal_completes_on_one_approval(client, session_factory):
    """
    No deliverables were listed, so the parties clearly settled the detail
    themselves. Refusing to let them close would be pedantry.
    """
    brand, creator, interest, _ = await _agreed_deal(session_factory, deliverables=None)

    submitted = await _submit(client, creator, interest.id, label="The post")
    assert submitted.status_code == 201
    approved = await _approve(
        client, brand, interest.id, submitted.json()["submissions"][0]["id"]
    )

    assert approved.json()["complete"] is True


# ---------------------------------------------------------------------------
# §1.5 — reviews
# ---------------------------------------------------------------------------

async def test_no_review_before_the_work_is_delivered(client, session_factory):
    """A review written before any work happened rates a conversation."""
    brand, _, interest, _ = await _agreed_deal(session_factory)

    res = await client.post(
        f"/deals/{interest.id}/review", json={"rating": 5},
        headers=auth_header(brand),
    )

    assert res.status_code == 400
    assert "delivered" in res.json()["detail"].lower()


async def test_a_review_is_hidden_until_both_sides_submit(client, session_factory):
    """
    The point of double-blind. Whoever goes second could otherwise read their
    rating and answer in kind.
    """
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)

    await client.post(f"/deals/{interest.id}/review",
                      json={"rating": 2, "comment": "Late and sloppy."},
                      headers=auth_header(brand))

    # The creator must not be able to see it before writing their own.
    seen = await client.get(f"/deals/{interest.id}/review", headers=auth_header(creator))
    body = seen.json()

    assert body["received"] is None
    assert body["revealed"] is False
    assert "sloppy" not in str(body)
    assert body["can_review"] is True


async def test_both_reviews_reveal_once_the_second_arrives(client, session_factory):
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)

    await client.post(f"/deals/{interest.id}/review", json={"rating": 2},
                      headers=auth_header(brand))
    await client.post(f"/deals/{interest.id}/review", json={"rating": 5},
                      headers=auth_header(creator))

    as_creator = (await client.get(f"/deals/{interest.id}/review",
                                   headers=auth_header(creator))).json()
    as_brand = (await client.get(f"/deals/{interest.id}/review",
                                 headers=auth_header(brand))).json()

    assert as_creator["revealed"] is True
    assert as_creator["received"]["rating"] == 2
    assert as_creator["mine"]["rating"] == 5
    assert as_brand["received"]["rating"] == 5


async def test_an_unanswered_review_reveals_after_the_window(client, session_factory):
    """
    Otherwise never reviewing is a way to suppress a bad rating forever.
    """
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)
    await client.post(f"/deals/{interest.id}/review", json={"rating": 1},
                      headers=auth_header(brand))

    # Age the review past the reveal window.
    async with session_factory() as db:
        review = (await db.execute(select(DealReview))).scalar()
        review.created_at = datetime.now(timezone.utc) - timedelta(
            days=REVIEW_REVEAL_DAYS + 1
        )
        await db.commit()

    seen = await client.get(f"/deals/{interest.id}/review", headers=auth_header(creator))

    assert seen.json()["revealed"] is True
    assert seen.json()["received"]["rating"] == 1


async def test_you_can_only_review_a_deal_once(client, session_factory):
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)

    first = await client.post(f"/deals/{interest.id}/review", json={"rating": 4},
                              headers=auth_header(brand))
    assert first.status_code == 201

    again = await client.post(f"/deals/{interest.id}/review", json={"rating": 1},
                              headers=auth_header(brand))
    assert again.status_code == 400
    assert "already reviewed" in again.json()["detail"].lower()


@pytest.mark.parametrize("bad_rating", [0, 6, -1])
async def test_ratings_outside_one_to_five_are_rejected(
    client, session_factory, bad_rating
):
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)

    res = await client.post(f"/deals/{interest.id}/review",
                            json={"rating": bad_rating}, headers=auth_header(brand))
    assert res.status_code == 422


async def test_a_public_track_record_counts_only_revealed_reviews(
    client, session_factory
):
    """
    Counting hidden reviews would leak them: an average that shifts the moment
    somebody submits says exactly what they wrote.
    """
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)
    await client.post(f"/deals/{interest.id}/review", json={"rating": 1},
                      headers=auth_header(brand))

    # One side has reviewed; nothing is revealed yet.
    hidden = await client.get(f"/deals/reviews/user/{creator.id}",
                              headers=auth_header(brand))
    assert hidden.json()["review_count"] == 0
    assert hidden.json()["average_rating"] is None

    await client.post(f"/deals/{interest.id}/review", json={"rating": 5},
                      headers=auth_header(creator))

    shown = await client.get(f"/deals/reviews/user/{creator.id}",
                             headers=auth_header(brand))
    assert shown.json()["review_count"] == 1
    assert shown.json()["average_rating"] == 1.0


async def test_the_track_record_points_at_the_right_person(client, session_factory):
    """A creator's rating must be what the brand said about them, not vice versa."""
    brand, creator, interest, _ = await _agreed_deal(session_factory)
    await _deliver_everything(client, brand, creator, interest.id)
    await client.post(f"/deals/{interest.id}/review", json={"rating": 2},
                      headers=auth_header(brand))    # brand rates creator 2
    await client.post(f"/deals/{interest.id}/review", json={"rating": 5},
                      headers=auth_header(creator))  # creator rates brand 5

    about_creator = (await client.get(f"/deals/reviews/user/{creator.id}",
                                      headers=auth_header(brand))).json()
    about_brand = (await client.get(f"/deals/reviews/user/{brand.id}",
                                    headers=auth_header(brand))).json()

    assert about_creator["average_rating"] == 2.0
    assert about_creator["reviews"][0]["author_role"] == "brand"
    assert about_brand["average_rating"] == 5.0
    assert about_brand["reviews"][0]["author_role"] == "creator"
