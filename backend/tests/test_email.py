"""
Email notifications (V3 Phase 4).

What must hold:

* an email is staged in the same transaction as the event, for the person who
  did not act, and a burst of messages is one email, not twenty;
* nothing is sent to someone who switched that kind of email off, or whose
  account is inactive — checked at send time, not stage time;
* the daily limit holds, failures retry a bounded number of times, and a rate
  limit stops the run without burning attempts;
* unsubscribe links work without signing in, and a forged one does nothing;
* no test can reach the network: delivery always gets a fake sender.
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.core.config import settings
from app.modules.deals.models import InterestStatus, OpportunityInterest
from app.modules.email import service
from app.modules.email.models import EmailOutbox, EmailPreference, EmailStatus
from app.modules.email.sender import SendError
from app.modules.email.service import (
    deliver_pending, read_unsubscribe_token, stage_email, unsubscribe_token,
)
from app.modules.email.templates import render_email
from app.modules.notifications.models import Notification
from app.modules.users.models import CreatorProfile, User
from tests.conftest import auth_header, make_brand_profile, make_creator_profile, make_user

OPPORTUNITY_ID = "aaaaaaaa-1111-2222-3333-444444444444"


class FakeSender:
    def __init__(self, fail: list[SendError] | None = None):
        self.sent = []
        self.fail = list(fail or [])

    async def send(self, email):
        if self.fail:
            raise self.fail.pop(0)
        self.sent.append(email)
        return f"re_{len(self.sent)}"


@pytest.fixture
def email_on(monkeypatch):
    """Email configured, but only ever with a fake sender."""
    monkeypatch.setattr(settings, "resend_api_key", "re_test_key")
    monkeypatch.setattr(settings, "public_api_url", "https://api.crewaa.in")
    monkeypatch.setattr(settings, "frontend_url", "https://crewaa.in")

    def no_real_sender():
        raise AssertionError("a test tried to use the real Resend sender")

    monkeypatch.setattr(service, "default_sender", no_real_sender)


async def _pair(session_factory):
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


async def _outbox(session_factory, **where):
    async with session_factory() as db:
        q = select(EmailOutbox).order_by(EmailOutbox.id)
        for k, v in where.items():
            q = q.where(getattr(EmailOutbox, k) == v)
        return (await db.execute(q)).scalars().all()


async def _stage(session_factory, user_id, kind="offer", **kw):
    async with session_factory() as db:
        await stage_email(db, user_id=user_id, kind=kind, subject=kw.pop("subject", "New offer received"),
                          body=kw.pop("body", "INR 40,000 proposed."), link="/dashboard/messages/1", **kw)
        await db.commit()


def _bind(session_factory):
    return session_factory.kw["bind"]


# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------

async def test_a_message_stages_one_email_for_the_recipient(client, session_factory):
    brand, creator, interest = await _pair(session_factory)

    for text in ("Hi, are you free?", "Also — can you do two reels?", "Thanks!"):
        res = await client.post(f"/messages/threads/{interest.id}", json={"body": text}, headers=auth_header(brand))
        assert res.status_code in (200, 201)

    rows = await _outbox(session_factory)
    assert [r.user_id for r in rows] == [creator.id]  # one email, to the recipient only
    assert rows[0].kind == "message" and rows[0].category == "messages"
    assert rows[0].subject.startswith("New message from")
    assert rows[0].cta_label == "Reply on Crewaa"


async def test_after_the_cooldown_a_new_message_emails_again(client, session_factory):
    brand, creator, interest = await _pair(session_factory)
    await client.post(f"/messages/threads/{interest.id}", json={"body": "one"}, headers=auth_header(brand))
    async with session_factory() as db:
        await db.execute(update(EmailOutbox).values(created_at=datetime.now(timezone.utc) - timedelta(hours=2)))
        await db.commit()
    await client.post(f"/messages/threads/{interest.id}", json={"body": "two"}, headers=auth_header(brand))
    assert len(await _outbox(session_factory, user_id=creator.id)) == 2


async def test_an_offer_emails_the_other_side(client, session_factory):
    brand, creator, interest = await _pair(session_factory)
    res = await client.post(
        f"/deals/{interest.id}/terms",
        json={"fee": 40000, "currency": "INR", "deliverables": ["1x Reel"]},
        headers=auth_header(brand),
    )
    assert res.status_code == 201
    rows = await _outbox(session_factory)
    assert [(r.user_id, r.kind) for r in rows] == [(creator.id, "offer")]


async def test_a_rolled_back_event_leaves_no_email(session_factory):
    brand, creator, _ = await _pair(session_factory)
    async with session_factory() as db:
        await stage_email(db, user_id=creator.id, kind="offer", subject="x", body="y")
        await db.rollback()
    assert await _outbox(session_factory) == []


async def test_kinds_that_are_not_emailed_stage_nothing(session_factory):
    brand, creator, _ = await _pair(session_factory)
    async with session_factory() as db:
        assert await stage_email(db, user_id=creator.id, kind="something_else", subject="x", body="y") is False


# ---------------------------------------------------------------------------
# Expressing interest now notifies the brand (in-app and email)
# ---------------------------------------------------------------------------

def _cached_deal(brand_id):
    return json.dumps([{"brand_id": brand_id, "opportunity": {
        "opportunity_id": OPPORTUNITY_ID, "fit_level": "High", "campaign_type": "Product Launch",
        "deliverables": ["1x Reel"], "status": "open",
    }}])


async def test_expressing_interest_notifies_the_brand_once(client, session_factory):
    brand = await make_user(session_factory, "brand@example.com", "BRAND")
    await make_brand_profile(session_factory, brand.id, brand_name="SecretBrand")
    creator = await make_user(session_factory, "creator@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, full_name="Aarav Mehta")
    async with session_factory() as db:
        profile = (await db.execute(select(CreatorProfile).where(CreatorProfile.user_id == creator.id))).scalar()
        profile.cached_brand_deals = _cached_deal(brand.id)
        await db.commit()

    for note in ("Would love to do this", "Edited note"):
        res = await client.post("/ai/opportunities/interest",
                                json={"opportunity_id": OPPORTUNITY_ID, "message": note},
                                headers=auth_header(creator))
        assert res.status_code == 200

    async with session_factory() as db:
        notes = (await db.execute(select(Notification).where(Notification.user_id == brand.id))).scalars().all()
    assert len(notes) == 1
    assert notes[0].kind == "interest"
    assert notes[0].title == "Aarav Mehta is interested in your product launch campaign"
    assert notes[0].body == "Would love to do this"
    assert notes[0].link == "/dashboard/brand/interested"
    # The creator is never told anything about the brand by this.
    async with session_factory() as db:
        assert (await db.execute(select(Notification).where(Notification.user_id == creator.id))).first() is None

    rows = await _outbox(session_factory)
    assert [(r.user_id, r.kind, r.category) for r in rows] == [(brand.id, "interest", "deals")]


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------

async def test_delivery_sends_to_the_current_address_with_unsubscribe(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    async with session_factory() as db:  # address changed after staging
        (await db.get(User, creator.id)).email = "new@example.com"
        await db.commit()

    sender = FakeSender()
    counts = await deliver_pending(_bind(session_factory), sender=sender, pause=0)

    assert counts["sent"] == 1
    [email] = sender.sent
    assert email.to == "new@example.com"
    assert email.subject == "New offer received"
    assert "INR 40,000 proposed." in email.text
    assert "https://crewaa.in/dashboard/messages/1" in email.html
    assert email.idempotency_key.startswith("crewaa-email-")
    assert email.headers["List-Unsubscribe"].startswith("<https://api.crewaa.in/email/unsubscribe?token=")
    assert email.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert "https://crewaa.in/unsubscribe?token=" in email.html
    [row] = await _outbox(session_factory)
    assert row.status == EmailStatus.SENT and row.provider_id == "re_1" and row.sent_at is not None

    # Delivering again sends nothing more.
    assert (await deliver_pending(_bind(session_factory), sender=sender, pause=0))["sent"] == 0


async def test_nothing_is_sent_while_email_is_off(session_factory):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    sender = FakeSender()
    assert (await deliver_pending(_bind(session_factory), sender=sender))["enabled"] is False
    assert sender.sent == []
    [row] = await _outbox(session_factory)
    assert row.status == EmailStatus.PENDING  # kept, not thrown away


async def test_a_switched_off_category_is_skipped_at_send_time(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id, kind="offer")
    await _stage(session_factory, creator.id, kind="message", subject="New message", interest_id=None)
    async with session_factory() as db:  # switched off after staging
        db.add(EmailPreference(user_id=creator.id, messages=True, deals=False, crew=True))
        await db.commit()

    sender = FakeSender()
    await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert [e.subject for e in sender.sent] == ["New message"]
    offer = (await _outbox(session_factory, kind="offer"))[0]
    assert (offer.status, offer.last_error) == (EmailStatus.SKIPPED, "preference")


async def test_inactive_accounts_get_nothing(session_factory, email_on):
    user = await make_user(session_factory, "gone@example.com", "INFLUENCER", is_active=False)
    await _stage(session_factory, user.id)
    sender = FakeSender()
    await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert sender.sent == []
    assert (await _outbox(session_factory))[0].last_error == "inactive"


async def test_the_daily_limit_defers_the_rest(session_factory, email_on, monkeypatch):
    monkeypatch.setattr(settings, "email_daily_limit", 1)
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    await _stage(session_factory, brand.id)
    sender = FakeSender()
    counts = await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert counts["sent"] == 1 and counts["deferred"] == 1
    assert [r.status for r in await _outbox(session_factory)] == [EmailStatus.SENT, EmailStatus.PENDING]


async def test_failures_retry_then_give_up(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    sender = FakeSender(fail=[SendError("500: boom")] * 3)
    for _ in range(3):
        await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    [row] = await _outbox(session_factory)
    assert (row.status, row.attempts) == (EmailStatus.FAILED, 3)
    assert sender.sent == []


async def test_a_permanent_error_is_not_retried(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    await deliver_pending(_bind(session_factory), sender=FakeSender(fail=[SendError("422: bad", retryable=False)]), pause=0)
    [row] = await _outbox(session_factory)
    assert (row.status, row.attempts) == (EmailStatus.FAILED, 1)


async def test_a_rate_limit_stops_the_run_without_using_an_attempt(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    await _stage(session_factory, brand.id)
    sender = FakeSender(fail=[SendError("rate limited", rate_limited=True)])
    counts = await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert counts["sent"] == 0 and sender.sent == []
    rows = await _outbox(session_factory)
    assert [(r.status, r.attempts) for r in rows] == [(EmailStatus.PENDING, 0), (EmailStatus.PENDING, 0)]


async def test_stale_emails_expire_and_stuck_claims_recover(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id, subject="old")
    await _stage(session_factory, brand.id, subject="stuck")
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        await db.execute(update(EmailOutbox).where(EmailOutbox.subject == "old")
                         .values(created_at=now - timedelta(days=4)))
        await db.execute(update(EmailOutbox).where(EmailOutbox.subject == "stuck")
                         .values(status=EmailStatus.SENDING, claimed_at=now - timedelta(hours=1)))
        await db.commit()
    sender = FakeSender()
    await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert [e.subject for e in sender.sent] == ["stuck"]
    old = (await _outbox(session_factory, subject="old"))[0]
    assert (old.status, old.last_error) == (EmailStatus.SKIPPED, "expired")


async def test_a_row_claimed_by_another_run_is_left_alone(session_factory, email_on):
    brand, creator, _ = await _pair(session_factory)
    await _stage(session_factory, creator.id)
    async with session_factory() as db:
        await db.execute(update(EmailOutbox).values(status=EmailStatus.SENDING, claimed_at=datetime.now(timezone.utc)))
        await db.commit()
    sender = FakeSender()
    await deliver_pending(_bind(session_factory), sender=sender, pause=0)
    assert sender.sent == []


async def test_commit_kicks_delivery_and_rollback_does_not(session_factory, email_on, monkeypatch):
    calls = []

    async def record(bind, **kw):
        calls.append(bind)
        return {}

    monkeypatch.setattr(service, "deliver_pending", record)
    brand, creator, _ = await _pair(session_factory)

    async with session_factory() as db:
        await stage_email(db, user_id=creator.id, kind="offer", subject="x", body="y")
        await db.rollback()
    async with session_factory() as db:
        await db.commit()  # an unrelated commit must not kick
    await asyncio.sleep(0.05)
    assert calls == []

    await _stage(session_factory, creator.id)
    await asyncio.sleep(0.05)
    assert len(calls) == 1


# ---------------------------------------------------------------------------
# Template
# ---------------------------------------------------------------------------

def test_the_template_escapes_everything():
    out = render_email(
        subject="<b>Hi</b>", body='Look <script>alert(1)</script> & "quotes"',
        cta_label="Open", cta_url='https://crewaa.in/x?a=1&b="2"', reason="Because.",
    )
    assert "<script>" not in out.html and "&lt;script&gt;" in out.html
    assert "<b>Hi</b>" not in out.html
    assert 'href="https://crewaa.in/x?a=1&amp;b=&quot;2&quot;"' in out.html
    assert "<script>alert(1)</script>" in out.text  # plain text stays plain


# ---------------------------------------------------------------------------
# Preferences and unsubscribe
# ---------------------------------------------------------------------------

async def test_preferences_default_on_and_update_partially(client, session_factory):
    user = await make_user(session_factory, "c@example.com", "INFLUENCER")
    res = await client.get("/email/preferences", headers=auth_header(user))
    assert res.json() == {"messages": True, "deals": True, "crew": True, "email_enabled": False}

    res = await client.put("/email/preferences", json={"messages": False}, headers=auth_header(user))
    assert res.json()["messages"] is False and res.json()["deals"] is True

    assert (await client.get("/email/preferences")).status_code == 401


async def test_unsubscribe_link_works_without_signing_in(client, session_factory):
    user = await make_user(session_factory, "c@example.com", "INFLUENCER")
    token = unsubscribe_token(user.id, "deals")
    # RFC 8058 one-click: the mail client POSTs this form body.
    res = await client.post(f"/email/unsubscribe?token={token}", data={"List-Unsubscribe": "One-Click"})
    assert res.status_code == 200 and res.json()["category"] == "deals"
    async with session_factory() as db:
        prefs = await db.get(EmailPreference, user.id)
    assert (prefs.messages, prefs.deals, prefs.crew) == (True, False, True)


async def test_unsubscribe_from_everything(client, session_factory):
    user = await make_user(session_factory, "c@example.com", "INFLUENCER")
    res = await client.post(f"/email/unsubscribe?token={unsubscribe_token(user.id, 'all')}")
    assert res.status_code == 200
    async with session_factory() as db:
        prefs = await db.get(EmailPreference, user.id)
    assert not (prefs.messages or prefs.deals or prefs.crew)


async def test_forged_or_altered_tokens_do_nothing(client, session_factory):
    victim = await make_user(session_factory, "v@example.com", "INFLUENCER")
    other = await make_user(session_factory, "o@example.com", "INFLUENCER")
    good = unsubscribe_token(other.id, "deals")
    forged = good.replace(f"{other.id}.", f"{victim.id}.", 1)
    for token in (forged, "nonsense", f"{victim.id}.deals.0000", f"{victim.id}.admin.{good.split('.')[-1]}"):
        assert (await client.post(f"/email/unsubscribe?token={token}")).status_code == 400
    async with session_factory() as db:
        assert await db.get(EmailPreference, victim.id) is None
    assert read_unsubscribe_token(good) == (other.id, "deals")


async def test_unsubscribe_is_not_a_get(client, session_factory):
    user = await make_user(session_factory, "c@example.com", "INFLUENCER")
    res = await client.get(f"/email/unsubscribe?token={unsubscribe_token(user.id, 'deals')}")
    assert res.status_code == 405  # link scanners follow GETs


# ---------------------------------------------------------------------------
# Waitlist confirmation and the scheduled retry
# ---------------------------------------------------------------------------

async def test_waitlist_confirms_once(client, session_factory):
    for _ in range(2):
        res = await client.post("/waitlist", json={"product": "ai_influencers", "email": "Lead@Brand.in"})
        assert res.status_code == 200
    rows = await _outbox(session_factory)
    assert [(r.to_email, r.kind, r.category) for r in rows] == [("lead@brand.in", "waitlist", "transactional")]


async def test_waitlist_confirmation_has_no_unsubscribe(session_factory, email_on, client):
    monkey_sender = FakeSender()
    async with session_factory() as db:
        await stage_email(db, kind="waitlist", to_email="lead@brand.in", subject="You're on the list", body="Thanks.")
        await db.commit()
    await deliver_pending(_bind(session_factory), sender=monkey_sender, pause=0)
    [email] = monkey_sender.sent
    assert email.to == "lead@brand.in"
    assert "List-Unsubscribe" not in email.headers
    assert "If that wasn't you" in email.text


async def test_send_emails_endpoint_is_guarded(client, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "")
    assert (await client.post("/internal/send-emails")).status_code == 404
    monkeypatch.setattr(settings, "cron_secret", "s3cret-value")
    assert (await client.post("/internal/send-emails", headers={"X-Cron-Secret": "wrong"})).status_code == 401
    res = await client.post("/internal/send-emails", headers={"X-Cron-Secret": "s3cret-value"})
    assert res.status_code == 200 and res.json()["enabled"] is False
