"""
LLM-as-a-Judge for Crewaa recommendation reasoning.

This module evaluates what deterministic regex and ID checks cannot:
the *quality, faithfulness, and nuance* of the model's generated reasoning.

Design principles:
1. Deterministic checks run first: If an ID is invented or a brand leaked,
   we fail immediately without wasting tokens on an LLM judge.
2. Structured Rubric: The judge scores against explicit, multi-point rubrics
   rather than open-ended 'how good is this' prompting.
3. Cheap judge tier: Uses lightweight, cost-effective models (e.g. Gemini Flash /
   GPT-4o-mini) with zero-temperature structured JSON output.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Structured Rubric Definitions
# ---------------------------------------------------------------------------

class RubricCriteria(BaseModel):
    name: str
    weight: float
    description: str
    pass_condition: str


RANKING_REASONING_RUBRIC = [
    RubricCriteria(
        name="factual_faithfulness",
        weight=0.35,
        description="The reasoning only cites metrics and facts present in the provided creator profile (no hallucinated subscriber counts, fake sponsorships, or phantom engagement stats).",
        pass_condition="Contains zero unsupported metric claims.",
    ),
    RubricCriteria(
        name="comparative_rationale",
        weight=0.35,
        description="The reasoning explicitly explains why this creator fits the campaign goals (e.g. niche alignment, engagement vs benchmark, location relevance) rather than generic praise.",
        pass_condition="Specifically contrasts niche or metrics with the brand's stated objective.",
    ),
    RubricCriteria(
        name="objective_tone",
        weight=0.15,
        description="The tone is professional, analytical, and honest about limitations or trade-offs rather than hyper-promotional fluff.",
        pass_condition="Free from hollow hype (e.g., 'superstar influencer', 'guaranteed virality').",
    ),
    RubricCriteria(
        name="privacy_compliance",
        weight=0.15,
        description="Creator-facing reasoning strictly adheres to anonymity rules and never leaks private client information.",
        pass_condition="Zero leaks of reserved brand identifiers or internal targets.",
    ),
]


# ---------------------------------------------------------------------------
# Judge Output Schemas
# ---------------------------------------------------------------------------

class CriteriaScore(BaseModel):
    score: int = Field(ge=1, le=5, description="Score from 1 (unacceptable) to 5 (flawless)")
    reasoning: str = Field(description="Specific citation or justification for this criterion score")
    passed: bool


class JudgeEvaluation(BaseModel):
    case_id: str
    overall_verdict: Literal["PASS", "FAIL", "NEEDS_REVIEW"]
    normalized_score: float = Field(ge=0.0, le=1.0, description="Weighted average score 0.0 - 1.0")
    criteria_scores: dict[str, CriteriaScore]
    failure_taxonomy_tags: list[str] = Field(
        default_factory=list,
        description="Taxonomy tags if failed: e.g. 'hallucinated_metric', 'generic_fluff', 'privacy_leak'",
    )
    judge_bias_flags: list[str] = Field(
        default_factory=list,
        description="Flags if judge suspects position bias, verbosity bias, etc.",
    )


# ---------------------------------------------------------------------------
# Judge Execution & Prompt Construction
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = """You are an expert AI Evaluation Judge auditing brand-creator match explanations.
Your role is to rigorously evaluate an explanation produced by an AI matching engine.

Be skeptical, strict, and evidence-based:
- Never reward verbosity or long-winded output if it lacks concrete substance (verbosity penalty).
- Check every claimed metric against the provided context. If the explanation claims '50k average reel views' but the context says '12k', mark factual_faithfulness as FAIL (score 1).
- Return your judgment strictly in the requested JSON format.
"""


def build_judge_prompt(
    brand_context: dict,
    creator_context: dict,
    model_output_reasoning: str,
    fit_level: str,
) -> str:
    """Builds a zero-shot structured rubric prompt for the evaluation judge."""
    return f"""### INPUT BRAND CONTEXT:
{json.dumps(brand_context, indent=2)}

### INPUT CREATOR PROFILE:
{json.dumps(creator_context, indent=2)}

### MODEL-GENERATED FIT LEVEL:
{fit_level}

### MODEL-GENERATED EXPLANATION TO EVALUATE:
\"\"\"{model_output_reasoning}\"\"\"

### RUBRIC:
1. factual_faithfulness (weight 35%): Does the explanation invent any metrics not in the profile?
2. comparative_rationale (weight 35%): Does it tie niche & metrics back to campaign goal?
3. objective_tone (weight 15%): Is it analytical without empty marketing fluff?
4. privacy_compliance (weight 15%): Does it respect confidential boundaries?

Score each criterion from 1 to 5.
Pass threshold for overall is normalized_score >= 0.70 with no criterion scoring 1.
"""


def evaluate_reasoning_heuristics(
    model_reasoning: str,
    creator_metrics: dict,
    min_length: int = 25,
    max_length: int = 600,
) -> dict:
    """
    Deterministic pre-check before calling LLM judge.
    Filters out empty responses, pure fluff, or obvious errors without spending API tokens.
    """
    issues = []
    text = (model_reasoning or "").strip()

    if len(text) < min_length:
        issues.append("too_short_or_empty")
    if len(text) > max_length:
        issues.append("excessive_verbosity")

    # Fluff checks
    fluff_phrases = ["great fit", "matches perfectly", "ideal influencer", "amazing choice"]
    is_pure_fluff = any(p in text.lower() for p in fluff_phrases) and len(text) < 60
    if is_pure_fluff:
        issues.append("unsupported_generic_fluff")

    return {
        "passed": len(issues) == 0,
        "precheck_issues": issues,
        "eligible_for_llm_judge": len(issues) == 0,
    }

