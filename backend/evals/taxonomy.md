# Evaluation Failure Taxonomy & Regression Protocol

> **Principle**: Group real failures from production logs and traces into a strict taxonomy *before* defining arbitrary metrics. Every production incident or user report must become a regression test case in `cases.py`.

---

## 1. Failure Taxonomy Classification

Failures in our LLM matchmaking and content generation pipelines are categorized into five distinct severity tiers:

### Tier 1: Safety & Privacy Violations (Immediate Blocker)
- **Definition**: Leaks confidential identifiers, exposes PII, or violates contractual anonymity.
- **Example**: An opportunity pitch generated for a creator that mentions the private brand name (e.g. "NutriFlex is looking for...") instead of maintaining anonymized campaign requirements.
- **Eval Mechanism**: Deterministic substring scan + regex boundary assertion.
- **Threshold**: **0 tolerance (100% pass required)**. Any violation fails CI.

### Tier 2: Factual Hallucinations & Entity Corruption (Fatal Correctness Error)
- **Definition**: The model invents non-existent identifiers or manufactures numbers contradictory to ground truth input data.
- **Examples**:
  - Model invents a `creator_id: "999"` not present in the candidate database.
  - Model claims a creator has "500k followers and 10% engagement" when raw data states "25k followers and 2.1%".
- **Eval Mechanism**: Python set-difference assertion against candidate input IDs (`sent_ids - returned_ids`) and metric bounding heuristics.
- **Threshold**: **0 tolerance**. Fails CI build immediately.

### Tier 3: Domain Misalignment & False Flattery (Business Logic Miss)
- **Definition**: Recommending an irrelevant creator as "High Fit" to please the user, or matching conflicting niches.
- **Examples**:
  - Rating a food creator as "High" fit for a hardcore gym supplement campaign.
  - Giving a "High" fit rating when no candidate in the pool matches a niche (flattering the brand rather than telling the truth).
- **Eval Mechanism**: `forbidden_high` assert sets in `cases.py`.
- **Threshold**: **0 tolerance on `forbidden_high`**; aggregate `quality_score >= 85%` across golden set.

### Tier 4: Reasoning Fluff & Low-Information Explanations (Reasoning Degradation)
- **Definition**: Model generates hollow marketing buzzwords instead of empirical justification referencing actual metrics.
- **Examples**:
  - "This creator is great because they have an awesome vibe and amazing audience!" (fails to cite engagement rate, audience demographics, or tier).
- **Eval Mechanism**: Heuristic length/fluff filter + LLM-as-a-Judge (`evals/judge.py`) scoring on `comparative_rationale` and `objective_tone`.
- **Threshold**: LLM judge normalized score `>= 0.70`.

### Tier 5: Schema Corruption & Malformed Output (Pipeline Degradation)
- **Definition**: Missing keys, wrong types, or invalid JSON preventing downstream consumption.
- **Eval Mechanism**: Pydantic validation schema.
- **Threshold**: **0 tolerance**.

---

## 2. From Production Failure to Regression Case (The 4-Step Protocol)

Whenever an anomaly or bad recommendation occurs in production:

1. **Capture Raw Trace**: Export the exact inputs (brand constraints + candidate creator payloads) and the raw LLM output from telemetry/logs.
2. **Classify in Taxonomy**: Determine whether it's Tier 1, 2, 3, 4, or 5.
3. **Draft Golden Case**:
   - Add to `cases.py` with an explicit `rationale` describing why human judgment marks this output wrong.
   - Specify `acceptable_top` and `forbidden_high` (or `forbidden_substrings`).
4. **Gate with CI**:
   - Verify the existing prompt fails on the new case.
   - Refine prompt/pipeline until the test passes.
   - Freeze response in `recorded.json` to lock in zero regressions for future merges.

