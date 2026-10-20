"""
Tests for LLM-as-a-judge rubric heuristics and calibration metrics.
"""

import pytest
from evals.calibration import (
    compute_cohens_kappa,
    detect_position_bias,
    detect_verbosity_bias,
    evaluate_judge_calibration,
    interpret_kappa,
)
from evals.judge import evaluate_reasoning_heuristics


def test_cohens_kappa_perfect_agreement():
    human = [1, 1, 0, 0, 1]
    judge = [1, 1, 0, 0, 1]
    kappa = compute_cohens_kappa(human, judge)
    assert kappa == 1.0
    assert interpret_kappa(kappa) == "Almost perfect agreement"


def test_cohens_kappa_substantial_agreement():
    human = [1, 1, 1, 1, 0, 0, 0, 1, 0, 1]
    judge = [1, 1, 1, 0, 0, 0, 0, 1, 0, 1]  # 1 disagreement out of 10
    metrics = evaluate_judge_calibration(
        [bool(x) for x in human],
        [bool(x) for x in judge],
    )
    assert metrics.accuracy == 0.9
    assert metrics.cohens_kappa > 0.75
    assert metrics.precision == 1.0
    assert "Substantial" in metrics.agreement_interpretation or "Almost perfect" in metrics.agreement_interpretation


def test_verbosity_bias_detection():
    # Long lengths paired with high scores
    char_lengths = [30, 80, 150, 300, 500, 800]
    scores = [1.0, 2.0, 3.0, 4.0, 4.5, 5.0]
    result = detect_verbosity_bias(char_lengths, scores)
    assert result["bias_detected"] is True
    assert result["pearson_correlation"] > 0.8


def test_position_bias_detection():
    # If swapping positions results in drastically different scores:
    order_a = [0.9, 0.85, 0.95, 0.8, 0.9]
    order_b = [0.2, 0.3, 0.1, 0.8, 0.3]  # 4 out of 5 flipped
    bias = detect_position_bias(order_a, order_b)
    assert bias["bias_detected"] is True
    assert bias["inconsistency_rate"] >= 0.8


def test_reasoning_heuristics_catches_fluff_and_empty():
    empty_res = evaluate_reasoning_heuristics("", {})
    assert empty_res["passed"] is False
    assert "too_short_or_empty" in empty_res["precheck_issues"]

    fluff_res = evaluate_reasoning_heuristics("Great fit! Matches perfectly.", {})
    assert fluff_res["passed"] is False
    assert "unsupported_generic_fluff" in fluff_res["precheck_issues"]

    good_res = evaluate_reasoning_heuristics(
        "Creator specializes in Bangalore tech reviews with 4.8% engagement rate, exceeding the 2.5% tier benchmark.",
        {},
    )
    assert good_res["passed"] is True

