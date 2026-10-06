"""
V3 Phase 2 — AI engine upgrade.

* Model replies are validated against a schema at the boundary.
* Every number the model reasons over is computed in code, with its benchmark.
* Low authenticity can never be shown as a High fit (enforced in code).
* Semantic pre-matching picks who the model sees, caches embeddings, and falls
  back silently when unavailable.
"""

import json
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.modules.ai import ai_service
from app.modules.ai.ai_service import GeminiClient, parse_structured
from app.modules.ai.llm_schemas import CampaignAssessmentOutput, RankingOutput
from app.modules.ai.matching import (
    apply_authenticity_guard, campaign_query, cosine, creator_document, semantic_order,
)
from app.modules.ai.metrics import authenticity_for_model, compare_to_typical, instagram_metrics
from tests.conftest import auth_header, make_creator_profile, make_user


# ------------------------------------------------------- structured output ----

def test_valid_reply_is_parsed_and_extra_keys_dropped():
    out = parse_structured(json.dumps({
        "ranked_creators": [{"creator_id": "7", "fit_level": "High", "surprise": 1}],
        "final_recommendation": "Go with 7",
    }), RankingOutput)
    assert out["ranked_creators"][0]["fit_level"] == "High"
    assert out["ranked_creators"][0]["risks"] == []
    assert "surprise" not in out["ranked_creators"][0]


def test_fenced_reply_still_parses():
    raw = 'Here you go:\n```json\n{"fit_level": "Medium", "why_it_fits": ["niche"]}\n```'
    assert parse_structured(raw, CampaignAssessmentOutput)["fit_level"] == "Medium"


@pytest.mark.parametrize("bad", [
    '{"fit_level": "high"}',              # wrong case: not in the enum
    '{"fit_level": "Excellent"}',
    '{"why_it_fits": ["missing fit"]}',
    '{"fit_level": "High", "why_it_fits": "not a list"}',
])
def test_malformed_reply_is_rejected_not_half_used(bad):
    with pytest.raises(ValueError):
        parse_structured(bad, CampaignAssessmentOutput)


class _Resp:
    def __init__(self, text):
        self.text = text


class _Models:
    def __init__(self):
        self.calls = []

    async def generate_content(self, *, model, contents, config):
        self.calls.append(config)
        return _Resp('{"ranked_creators": [], "final_recommendation": "none"}')

    async def embed_content(self, *, model, contents, config):
        self.calls.append(config)
        return SimpleNamespace(embeddings=[SimpleNamespace(values=[3.0, 4.0]) for _ in contents])


@pytest.fixture
def fake_sdk(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    models = _Models()
    monkeypatch.setattr(ai_service.genai, "Client",
                        lambda **kw: SimpleNamespace(aio=SimpleNamespace(models=models)))
    return models


async def test_schema_is_sent_to_gemini(fake_sdk):
    client = GeminiClient()
    await client.generate("rank these", schema=RankingOutput)
    assert fake_sdk.calls[-1].response_schema is RankingOutput
    assert fake_sdk.calls[-1].response_mime_type == "application/json"


async def test_ranking_engine_uses_the_schema(fake_sdk):
    out = await ai_service.BrandCreatorRankingEngine().rank_creators({}, [])
    assert out == {"ranked_creators": [], "final_recommendation": "none"}
    assert fake_sdk.calls[-1].response_schema is RankingOutput


async def test_embeddings_are_normalised(fake_sdk, monkeypatch):
    monkeypatch.setattr(settings, "embedding_dimensions", 768)
    vecs = await GeminiClient().embed(["a", "b"], "RETRIEVAL_DOCUMENT")
    assert vecs == [[0.6, 0.8], [0.6, 0.8]]
    assert fake_sdk.calls[-1].task_type == "RETRIEVAL_DOCUMENT"
    assert fake_sdk.calls[-1].output_dimensionality == 768


# ------------------------------------------------------------- metrics ----

def _post(likes, comments, views=None, video=False):
    return SimpleNamespace(likes=likes, comments=comments, views=views, is_video=video)


def test_instagram_metrics_carry_their_benchmark():
    m = instagram_metrics(40_000, [_post(1_500, 40, 12_000, True), _post(1_500, 40)], datetime.utcnow())
    assert m["engagement_rate_pct"] == 3.85
    assert m["typical_engagement_for_size_pct"] == 3.5
    assert m["engagement_vs_typical"] == "in line with typical"
    assert m["follower_tier"] == "micro (10K–50K)"
    assert m["avg_reel_views"] == 12_000
    assert m["reel_views_as_pct_of_followers"] == 30.0
    assert m["data_age_days"] == 0


def test_compare_to_typical_bands():
    assert compare_to_typical(0.09, 0.035) == "well above typical"
    assert compare_to_typical(0.02, 0.035) == "below typical"
    assert compare_to_typical(0.002, 0.035) == "far below typical"


def test_model_sees_only_concerns_from_authenticity():
    report = SimpleNamespace(platform="instagram", score=58, level="low", signals=[
        {"status": "good", "detail": "fine"},
        {"status": "bad", "detail": "Likes vastly outnumber comments."},
        {"status": "unknown", "detail": "n/a"},
    ])
    assert authenticity_for_model([report]) == {
        "instagram": {"score": 58, "level": "low", "concerns": ["Likes vastly outnumber comments."]}
    }


async def test_payload_has_computed_metrics_and_no_invented_pricing(session_factory):
    from app.modules.ai.router import _build_creator_payloads
    from app.modules.instagram.models.instagram import InstagramPost, InstagramProfile
    from app.modules.users.models import CreatorProfile

    user = await make_user(session_factory, "payload@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, user.id)
    now = datetime.utcnow()
    async with session_factory() as db:
        db.add(InstagramProfile(user_id=user.id, username="p", followers=40_000, scraped_at=now))
        for i in range(4):
            db.add(InstagramPost(user_id=user.id, likes=1_500, comments=40, scraped_at=now,
                                 posted_at=now - timedelta(days=i)))
        await db.commit()
        creators = list((await db.execute(select(CreatorProfile))).scalars())
        payload = (await _build_creator_payloads(creators, db))[user.id]

    assert "pricing" not in payload["creator_identity"]
    ig = payload["platforms"][0]
    assert ig["computed"]["engagement_vs_typical"] == "in line with typical"
    assert payload["authenticity"] is None  # not scored yet


# ---------------------------------------------------- authenticity guard ----

def _ranked(cid, fit, risks=None):
    return SimpleNamespace(creator_id=str(cid), fit_level=fit, risks=risks or [])


def test_low_authenticity_is_never_a_high_fit():
    ranked = [_ranked(1, "High", ["small audience"]), _ranked(2, "Medium"), _ranked(3, "High")]
    out = apply_authenticity_guard(ranked, {
        1: {"level": "low", "score": 38, "highlights": ["Followers jumped sharply in a short time."]},
        2: {"level": "insufficient", "score": None, "highlights": []},
        3: {"level": "high", "score": 95, "highlights": []},
    })
    by_id = {r.creator_id: r for r in out}
    assert by_id["1"].fit_level == "Medium"
    assert by_id["1"].risks[0].startswith("Low Authenticity Score (38/100)")
    assert by_id["1"].risks[1] == "small audience"
    assert "Not enough public data" in by_id["2"].risks[-1]
    assert by_id["3"].fit_level == "High"
    assert [r.creator_id for r in out] == ["3", "1", "2"]  # High first, model order kept within a level


# ---------------------------------------------------- semantic matching ----

class FakeEmbedder:
    """Vectors from keywords, so similarity is predictable."""
    AXES = ["fitness", "food", "tech"]

    def __init__(self):
        self.document_calls = 0

    async def embed(self, texts, task_type):
        if task_type == "RETRIEVAL_DOCUMENT":
            self.document_calls += len(texts)
        out = []
        for t in texts:
            v = [float(t.lower().count(a)) + 0.01 for a in self.AXES]
            n = sum(x * x for x in v) ** 0.5
            out.append([x / n for x in v])
        return out


def _creator(uid, category, bio):
    return SimpleNamespace(user_id=uid, category=category, location="Pune", primary_platform="Instagram", bio=bio)


async def test_semantic_order_prefers_meaning_and_caches(session_factory):
    creators = [_creator(1, "Lifestyle", "tech gadgets reviews"),
                _creator(2, "Lifestyle", "fitness workouts and fitness tips"),
                _creator(3, "Lifestyle", "street food")]
    emb = FakeEmbedder()
    async with session_factory() as db:
        ordered = await semantic_order(
            db, kind="creator", query_text="fitness supplement launch", items=creators,
            doc_for=lambda c: creator_document(c, {}), id_for=lambda c: c.user_id, client=emb,
        )
        assert [c.user_id for c in ordered] == [2, 1, 3]
        assert emb.document_calls == 3

        # Second run: nothing changed, nothing re-embedded.
        await semantic_order(db, kind="creator", query_text="fitness", items=creators,
                             doc_for=lambda c: creator_document(c, {}), id_for=lambda c: c.user_id, client=emb)
        assert emb.document_calls == 3

        # One bio changes: only that creator is re-embedded.
        creators[2].bio = "street food and fitness meals"
        await semantic_order(db, kind="creator", query_text="fitness", items=creators,
                             doc_for=lambda c: creator_document(c, {}), id_for=lambda c: c.user_id, client=emb)
        assert emb.document_calls == 4


async def test_semantic_order_falls_back_when_unavailable(session_factory):
    class Broken:
        async def embed(self, texts, task_type):
            raise RuntimeError("Gemini API quota exceeded")

    async with session_factory() as db:
        assert await semantic_order(db, kind="creator", query_text="x", items=[_creator(1, "A", "b")],
                                    doc_for=lambda c: "doc", id_for=lambda c: c.user_id, client=Broken()) is None


def test_cosine_of_normalised_vectors():
    assert cosine([0.6, 0.8], [0.6, 0.8]) == pytest.approx(1.0)


def test_campaign_query_uses_the_brief():
    q = campaign_query({"brand_identity": {"industry": "Fitness", "campaign_goal": "Sales"},
                        "campaign": {"brief": "Protein bar launch for gym-goers"},
                        "platform_preferences": ["instagram"]})
    assert "Protein bar launch" in q and "Fitness" in q


# ------------------------------------------------------------ end to end ----

async def test_discovery_caps_low_authenticity_and_tells_the_brand(client, session_factory, monkeypatch):
    from app.modules.authenticity.models import AuthenticityReport
    from app.modules.users.models import SavedCreator

    brand = await make_user(session_factory, "guard-brand@example.com", "BRAND")
    risky = await make_user(session_factory, "risky@example.com", "INFLUENCER")
    await make_creator_profile(session_factory, risky.id, category="Fitness")
    async with session_factory() as db:
        db.add(AuthenticityReport(
            user_id=risky.id, platform="instagram", score=35, level="low", audience=90_000,
            signals=[{"key": "growth", "label": "Follower growth", "status": "bad", "value": "+40%",
                      "detail": "Followers jumped sharply in a short time."}],
            computed_at=datetime.utcnow(),
        ))
        await db.commit()

    async def fake_rank(self, brand_data, creators_data):
        # The model is wrong on purpose: it calls the risky creator a High fit.
        assert creators_data[0]["authenticity"]["instagram"]["level"] == "low"
        return {"ranked_creators": [{"creator_id": str(risky.id), "fit_level": "High", "risks": []}],
                "final_recommendation": "ok"}

    monkeypatch.setattr("app.modules.ai.ai_service.BrandCreatorRankingEngine.rank_creators", fake_rank)
    monkeypatch.setattr("app.modules.ai.ai_service.GeminiClient.__init__", lambda self, model=None: None)

    res = await client.post("/ai/discover-creators", json={"niche": "Fitness"}, headers=auth_header(brand))
    assert res.status_code == 200
    pick = res.json()["ranked_creators"][0]
    assert pick["fit_level"] == "Medium"
    assert pick["risks"][0].startswith("Low Authenticity Score (35/100)")
    assert pick["authenticity"]["level"] == "low"

    async with session_factory() as db:
        saved = (await db.execute(select(SavedCreator))).scalar()
    assert saved.fit_level == "Medium"
