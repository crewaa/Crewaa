"""
Trust & safety (V2 Phase 3): blocking, reporting, disputes, verification.

Messaging between strangers shipped in August with no way to report or block
anyone, and delivery records shipped with no way to contest one. What these
tests protect is not the happy path but the handful of properties that make
these records worth having:

* a block stops messages **both** ways, so it cannot be used as a one-way
  megaphone,
* blocking never destroys the conversation, because that conversation is the
  evidence,
* the reported person is never told,
* and a dispute changes nothing about the delivery record it concerns.
"""

import asyncio

from sqlalchemy import select

from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.notifications.models import Notification
from app.modules.trust.models import (
    DealDispute, ReportStatus, UserBlock, UserReport, VerificationStatus,
)
from tests.conftest import (
    auth_header, make_brand_profile, make_creator_profile, make_user,
)

OPPORTUNITY_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


async def _seed(session_factory):
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    await make_brand_profile(session_factory, brand.id, brand_name="NutriFlex")
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
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


async def _send(client, interest, sender, body="hello"):
    return await client.post(
        f"/messages/threads/{interest.id}",
        json={"body": body},
        headers=auth_header(sender),
    )


# ---------------------------------------------------------------------------
# Blocking
# ---------------------------------------------------------------------------

async def test_blocking_stops_messages_in_both_directions(client, session_factory):
    """
    The property that makes block meaningful.

    A one-way block would let the blocker keep sending while the blocked person
    cannot reply — a mute button that still lets you shout. A brand could block
    a creator and go on messaging them with no way to answer.
    """
    brand, creator, interest = await _seed(session_factory)

    blocked = await client.post(
        "/trust/block", json={"interest_id": interest.id},
        headers=auth_header(creator),
    )
    assert blocked.status_code == 200

    assert (await _send(client, interest, brand)).status_code == 403
    # And the blocker is stopped too.
    assert (await _send(client, interest, creator)).status_code == 403


async def test_blocking_does_not_destroy_the_conversation(client, session_factory):
    """
    The thread stays readable to both sides. Making messages vanish would let
    someone unsay what they wrote by blocking whoever they wrote it to — and
    would delete the evidence for any report about it.
    """
    brand, creator, interest = await _seed(session_factory)
    await _send(client, interest, brand, "something worth reporting")

    await client.post(
        "/trust/block", json={"interest_id": interest.id},
        headers=auth_header(creator),
    )

    thread = await client.get(
        f"/messages/threads/{interest.id}", headers=auth_header(creator)
    )
    assert thread.status_code == 200
    assert any(
        "something worth reporting" in m["body"] for m in thread.json()["messages"]
    )


async def test_unblocking_restores_messaging(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    await client.post(
        "/trust/block", json={"interest_id": interest.id}, headers=auth_header(creator)
    )

    await client.post(
        "/trust/unblock", json={"interest_id": interest.id}, headers=auth_header(creator)
    )

    assert (await _send(client, interest, brand)).status_code == 201


async def test_one_side_cannot_lift_the_others_block(client, session_factory):
    """
    Otherwise block is worthless: whoever was blocked simply unblocks
    themselves and carries on.
    """
    brand, creator, interest = await _seed(session_factory)
    await client.post(
        "/trust/block", json={"interest_id": interest.id}, headers=auth_header(creator)
    )

    res = await client.post(
        "/trust/unblock", json={"interest_id": interest.id}, headers=auth_header(brand)
    )

    assert res.json()["blocked"] is True
    assert (await _send(client, interest, brand)).status_code == 403


async def test_blocking_twice_is_not_an_error(client, session_factory):
    """A double submit or a second tab. The desired state is the current one."""
    brand, creator, interest = await _seed(session_factory)

    first = await client.post(
        "/trust/block", json={"interest_id": interest.id}, headers=auth_header(creator)
    )
    second = await client.post(
        "/trust/block", json={"interest_id": interest.id}, headers=auth_header(creator)
    )

    assert first.status_code == second.status_code == 200
    async with session_factory() as db:
        rows = (await db.execute(select(UserBlock))).scalars().all()
    assert len(rows) == 1


async def test_a_stranger_cannot_block_on_someone_elses_deal(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    outsider = await make_user(session_factory, "outsider@example.com", "BRAND")

    res = await client.post(
        "/trust/block", json={"interest_id": interest.id}, headers=auth_header(outsider)
    )

    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

async def test_the_reported_person_is_never_told(client, session_factory):
    """
    A report that notifies its subject invites retaliation, and teaches people
    that reporting makes their situation more dangerous.
    """
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        "/trust/report",
        json={"interest_id": interest.id, "reason": "harassment",
              "detail": "Repeated abusive messages."},
        headers=auth_header(creator),
    )
    assert res.status_code == 201

    async with session_factory() as db:
        notifications = (await db.execute(
            select(Notification).where(Notification.user_id == brand.id)
        )).scalars().all()
    assert notifications == []


async def test_reporting_does_not_block(client, session_factory):
    """
    Separate on purpose. Plenty of people want the behaviour on record without
    ending a deal — tying them together means whoever cannot afford to end it
    never reports at all.
    """
    brand, creator, interest = await _seed(session_factory)

    await client.post(
        "/trust/report",
        json={"interest_id": interest.id, "reason": "spam"},
        headers=auth_header(creator),
    )

    assert (await _send(client, interest, brand)).status_code == 201


async def test_an_unknown_reason_is_rejected(client, session_factory):
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        "/trust/report",
        json={"interest_id": interest.id, "reason": "i-just-dont-like-them"},
        headers=auth_header(creator),
    )

    assert res.status_code == 400


async def test_other_requires_an_explanation(client, session_factory):
    """'Other' with no detail gives an admin nothing at all to act on."""
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        "/trust/report",
        json={"interest_id": interest.id, "reason": "other"},
        headers=auth_header(creator),
    )

    assert res.status_code == 400


async def test_the_report_response_reveals_nothing(client, session_factory):
    """
    No id, no status. Either would give the reporter something to quote at the
    person they reported.
    """
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        "/trust/report",
        json={"interest_id": interest.id, "reason": "scam"},
        headers=auth_header(creator),
    )

    assert res.json() == {"received": True}


async def test_only_an_admin_can_read_the_report_queue(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    await client.post(
        "/trust/report", json={"interest_id": interest.id, "reason": "spam"},
        headers=auth_header(creator),
    )

    assert (await client.get(
        "/admin/trust/reports", headers=auth_header(creator)
    )).status_code == 403

    admin = await make_user(session_factory, "admin@example.com", "ADMIN")
    allowed = await client.get("/admin/trust/reports", headers=auth_header(admin))
    assert allowed.status_code == 200
    assert len(allowed.json()) == 1


async def test_resolving_a_report_records_which_admin_did_it(client, session_factory):
    """A moderation record with no name on it is not a moderation record."""
    brand, creator, interest = await _seed(session_factory)
    admin = await make_user(session_factory, "admin@example.com", "ADMIN")
    await client.post(
        "/trust/report", json={"interest_id": interest.id, "reason": "spam"},
        headers=auth_header(creator),
    )

    async with session_factory() as db:
        report_id = (await db.execute(select(UserReport.id))).scalar()

    res = await client.post(
        f"/admin/trust/reports/{report_id}",
        json={"status": "actioned", "note": "Account warned."},
        headers=auth_header(admin),
    )
    assert res.status_code == 200

    async with session_factory() as db:
        report = (await db.execute(select(UserReport))).scalar()
    assert report.reviewed_by_id == admin.id
    assert report.status == ReportStatus.ACTIONED


# ---------------------------------------------------------------------------
# Disputes
# ---------------------------------------------------------------------------

async def test_a_dispute_changes_nothing_about_the_record(client, session_factory):
    """
    V2's scope is the flag plus admin visibility. A dispute that could alter a
    delivery would let either party rewrite the timestamped evidence the
    argument is actually about.
    """
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        f"/trust/disputes/{interest.id}",
        json={"reason": "not_delivered",
              "detail": "The reel was never posted on the agreed date."},
        headers=auth_header(brand),
    )
    assert res.status_code == 201

    async with session_factory() as db:
        refreshed = (await db.execute(
            select(OpportunityInterest).where(OpportunityInterest.id == interest.id)
        )).scalar()
    assert refreshed.status == InterestStatus.INTERESTED


async def test_only_one_open_dispute_per_deal(client, session_factory):
    brand, creator, interest = await _seed(session_factory)
    payload = {"reason": "not_delivered", "detail": "Nothing was ever posted."}

    first = await client.post(
        f"/trust/disputes/{interest.id}", json=payload, headers=auth_header(brand)
    )
    second = await client.post(
        f"/trust/disputes/{interest.id}", json=payload, headers=auth_header(creator)
    )

    assert first.status_code == 201
    assert second.status_code == 409


async def test_concurrent_disputes_cannot_both_open(client, session_factory):
    """
    The partial unique index, not the handler, is the guarantee. A read-then-
    write check loses a genuine race, and two open disputes on one deal have no
    sensible resolution.
    """
    brand, creator, interest = await _seed(session_factory)
    payload = {"reason": "not_delivered", "detail": "Nothing was ever posted."}

    results = await asyncio.gather(*[
        client.post(
            f"/trust/disputes/{interest.id}", json=payload, headers=auth_header(brand)
        )
        for _ in range(4)
    ], return_exceptions=True)

    created = [r for r in results if getattr(r, "status_code", None) == 201]
    assert len(created) == 1, [getattr(r, "status_code", r) for r in results]


async def test_both_parties_see_a_dispute_raised_against_them(client, session_factory):
    """Being disputed without being told makes the flag useless as a prompt."""
    brand, creator, interest = await _seed(session_factory)
    await client.post(
        f"/trust/disputes/{interest.id}",
        json={"reason": "not_delivered", "detail": "Nothing was ever posted."},
        headers=auth_header(brand),
    )

    seen = await client.get(
        f"/trust/disputes/{interest.id}", headers=auth_header(creator)
    )

    assert len(seen.json()) == 1
    assert seen.json()[0]["raised_by_me"] is False


async def test_a_dispute_needs_a_real_explanation(client, session_factory):
    brand, creator, interest = await _seed(session_factory)

    res = await client.post(
        f"/trust/disputes/{interest.id}",
        json={"reason": "not_delivered", "detail": "bad"},
        headers=auth_header(brand),
    )

    assert res.status_code == 422


async def test_resolving_a_dispute_requires_a_written_outcome(client, session_factory):
    """
    A dispute that closes with no explanation is worse than one left open: it
    tells whoever raised it they were overruled without saying why.
    """
    brand, creator, interest = await _seed(session_factory)
    admin = await make_user(session_factory, "admin@example.com", "ADMIN")
    await client.post(
        f"/trust/disputes/{interest.id}",
        json={"reason": "not_delivered", "detail": "Nothing was ever posted."},
        headers=auth_header(brand),
    )
    async with session_factory() as db:
        dispute_id = (await db.execute(select(DealDispute.id))).scalar()

    missing = await client.post(
        f"/admin/trust/disputes/{dispute_id}",
        json={"status": "resolved"}, headers=auth_header(admin),
    )
    assert missing.status_code == 422

    ok = await client.post(
        f"/admin/trust/disputes/{dispute_id}",
        json={"status": "resolved", "note": "Post was live, link confirmed."},
        headers=auth_header(admin),
    )
    assert ok.status_code == 200


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

async def test_verification_starts_unverified_and_can_be_requested(
    client, session_factory
):
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")

    initial = await client.get("/trust/verification", headers=auth_header(creator))
    assert initial.json()["status"] == VerificationStatus.UNVERIFIED

    requested = await client.post("/trust/verification", headers=auth_header(creator))
    assert requested.json()["status"] == VerificationStatus.PENDING


async def test_requesting_twice_while_pending_is_rejected(client, session_factory):
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await client.post("/trust/verification", headers=auth_header(creator))

    again = await client.post("/trust/verification", headers=auth_header(creator))

    assert again.status_code == 400


async def test_a_rejection_must_say_why(client, session_factory):
    """
    The user can request again, so "rejected" with no reason leaves them
    resubmitting the same thing forever.
    """
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    admin = await make_user(session_factory, "admin@example.com", "ADMIN")
    await client.post("/trust/verification", headers=auth_header(creator))

    silent = await client.post(
        f"/admin/trust/verifications/{creator.id}",
        json={"approve": False}, headers=auth_header(admin),
    )
    assert silent.status_code == 400

    explained = await client.post(
        f"/admin/trust/verifications/{creator.id}",
        json={"approve": False, "note": "The Instagram handle does not match."},
        headers=auth_header(admin),
    )
    assert explained.status_code == 200
    assert explained.json()["status"] == VerificationStatus.REJECTED


async def test_a_rejected_user_can_fix_it_and_reapply(client, session_factory):
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    admin = await make_user(session_factory, "admin@example.com", "ADMIN")
    await client.post("/trust/verification", headers=auth_header(creator))
    await client.post(
        f"/admin/trust/verifications/{creator.id}",
        json={"approve": False, "note": "Handle does not match."},
        headers=auth_header(admin),
    )

    retry = await client.post("/trust/verification", headers=auth_header(creator))

    assert retry.status_code == 200
    assert retry.json()["status"] == VerificationStatus.PENDING
    # The old rejection note must not hang over a fresh request.
    assert retry.json()["note"] is None


async def test_only_an_admin_can_verify_anyone(client, session_factory):
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    other = await make_user(session_factory, "other@example.com", "BRAND")
    await client.post("/trust/verification", headers=auth_header(creator))

    res = await client.post(
        f"/admin/trust/verifications/{creator.id}",
        json={"approve": True}, headers=auth_header(other),
    )

    assert res.status_code == 403


async def test_verification_is_a_signal_not_a_gate(client, session_factory):
    """
    Nothing in the product is gated on verification yet, and that is
    deliberate: gating discovery on it would silently delist every existing
    creator the moment it shipped.
    """
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id)

    me = await client.get("/users/me", headers=auth_header(creator))

    assert me.status_code == 200
