"""AI Influencers waitlist (V3 Phase 3) and the brand-facing creator profile."""

from sqlalchemy import select

from app.modules.waitlist.models import WaitlistEntry
from tests.conftest import auth_header, make_creator_profile, make_user


async def test_anyone_can_join_and_joining_twice_is_harmless(client, session_factory):
    body = {"product": "ai_influencers", "email": "Founder@Brand.in", "name": "Asha", "company": "Brand"}
    first = await client.post("/waitlist", json=body)
    again = await client.post("/waitlist", json={**body, "email": "founder@brand.in"})

    # Same answer either way, so the endpoint cannot be used to test which emails signed up.
    assert first.status_code == again.status_code == 200
    assert first.json() == again.json() == {"status": "joined", "product": "ai_influencers"}
    async with session_factory() as db:
        rows = (await db.execute(select(WaitlistEntry))).scalars().all()
    assert [(r.email, r.name, r.company) for r in rows] == [("founder@brand.in", "Asha", "Brand")]


async def test_signed_up_users_are_linked(client, session_factory):
    brand = await make_user(session_factory, "known@brand.in", "BRAND")
    await client.post("/waitlist", json={"product": "ai_influencers", "email": "known@brand.in"})
    async with session_factory() as db:
        row = (await db.execute(select(WaitlistEntry))).scalar()
    assert row.user_id == brand.id


async def test_only_launching_products_accept_signups(client):
    for product in ("grow", "marketing_suite", "anything"):
        res = await client.post("/waitlist", json={"product": product, "email": "a@b.in"})
        assert res.status_code == 422, product
    assert (await client.post("/waitlist", json={"product": "ai_influencers", "email": "not-an-email"})).status_code == 422


async def test_waitlist_is_rate_limited(client):
    codes = [
        (await client.post("/waitlist", json={"product": "ai_influencers", "email": f"x{i}@b.in"})).status_code
        for i in range(7)
    ]
    assert codes[:5] == [200] * 5 and 429 in codes[5:]


async def test_only_admins_can_read_the_list(client, session_factory):
    await client.post("/waitlist", json={"product": "ai_influencers", "email": "one@b.in"})
    admin = await make_user(session_factory, "admin@crewaa.in", "ADMIN")
    brand = await make_user(session_factory, "nosy@brand.in", "BRAND")

    assert (await client.get("/admin/waitlist", headers=auth_header(brand))).status_code == 403
    res = await client.get("/admin/waitlist", headers=auth_header(admin))
    assert res.status_code == 200 and res.json()["total"] == 1
    assert res.json()["entries"][0]["email"] == "one@b.in"


async def test_brand_can_open_a_creator_profile_without_contact_details(client, session_factory):
    creator = await make_user(session_factory, "private@creator.in", "INFLUENCER")
    await make_creator_profile(session_factory, creator.id, full_name="Ananya", instagram_username="ananya.eats")
    brand = await make_user(session_factory, "viewer@brand.in", "BRAND")
    other = await make_user(session_factory, "peer@creator.in", "INFLUENCER")

    res = await client.get(f"/ai/creators/{creator.id}", headers=auth_header(brand))
    assert res.status_code == 200
    body = res.json()
    assert body["creator_name"] == "Ananya"
    assert body["instagram_url"] == "https://instagram.com/ananya.eats"
    assert "private@creator.in" not in res.text

    assert (await client.get(f"/ai/creators/{creator.id}", headers=auth_header(other))).status_code == 403
    assert (await client.get("/ai/creators/999999", headers=auth_header(brand))).status_code == 404
