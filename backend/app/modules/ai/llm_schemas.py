"""
Output schemas the model must fill (V3 Phase 2).

Each one mirrors, field for field, the JSON the matching prompt in
ai_service.py already asks for. They are passed to Gemini as `response_schema`,
so the API constrains generation to this exact shape, and the reply is then
validated here again before anything uses it — a guarantee from a remote
service is not a guarantee in this process.

What changed from V2: the prompts asked for JSON and `extract_json` dug it out
of whatever came back. A missing key, a "high" instead of "High", or a string
where a list belonged flowed straight into the routers. Now that is a
validation error at the boundary, reported as an AI failure, never a half-built
result.

Deliberately lenient where the prompt is loose (lists default to empty, extra
keys are ignored) and strict where it matters (fit levels are an enum).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FitLevel = Literal["High", "Medium", "Low"]


class _Out(BaseModel):
    model_config = ConfigDict(extra="ignore")


class RankedPick(_Out):
    creator_id: str
    creator_name: str | None = None  # ignored by the router; facts come from the DB
    fit_level: FitLevel
    score_reasoning: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    recommended_campaign_type: str | None = None


class RankingOutput(_Out):
    ranked_creators: list[RankedPick] = Field(default_factory=list)
    final_recommendation: str | None = None


class CreatorProfileOutput(_Out):
    creator_id: str | None = None
    summary: str
    strengths: list[str] = Field(default_factory=list)
    improvement_areas: list[str] = Field(default_factory=list)
    best_brand_categories: list[str] = Field(default_factory=list)
    recommended_content_formats: list[str] = Field(default_factory=list)


class CampaignAssessmentOutput(_Out):
    fit_level: FitLevel
    industry_hint: str | None = None
    why_it_fits: list[str] = Field(default_factory=list)
    what_to_expect: str | None = None


class AnonymousOpportunityOutput(_Out):
    opportunity_id: str | None = None  # always replaced server-side
    fit_level: FitLevel
    industry_hint: str | None = None
    campaign_type: str | None = None
    campaign_requirements: str | None = None
    compensation: str | None = None
    timeline: str | None = None
    deliverables: list[str] = Field(default_factory=list)
    status: str = "open"
