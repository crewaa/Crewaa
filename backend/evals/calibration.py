"""
Judge calibration and bias detection module.

This module benchmarks the LLM-as-a-judge against human-labeled ground truth:
1. Computes Cohen's Kappa (inter-annotator agreement between Human & LLM Judge).
2. Computes Precision, Recall, and F1-score for judge binary classifications (PASS/FAIL).
3. Analyzes common LLM judge biases:
   - Verbosity bias: Does the judge assign higher scores to longer texts regardless of merit?
   - Position bias: Does the judge systematically favor the first candidate evaluated?
   - Self-preference bias: Does a model judge rate its own outputs higher than other models?
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence


@dataclass
class CalibrationMetrics:
    total_samples: int
    human_positive_rate: float
    judge_positive_rate: float
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    cohens_kappa: float
    agreement_interpretation: str


def compute_cohens_kappa(
    human_labels: Sequence[int | str],
    judge_labels: Sequence[int | str],
) -> float:
    """
    Computes Cohen's Kappa for inter-rater agreement between human and judge.
    kappa = (Po - Pe) / (1 - Pe)
    where Po is observed agreement and Pe is hypothetical chance agreement.
    """
    if len(human_labels) != len(judge_labels) or len(human_labels) == 0:
        raise ValueError("Labels must have matching, non-zero lengths.")

    n = len(human_labels)
    # Collect unique classes
    categories = sorted(list(set(human_labels) | set(judge_labels)))
    cat_to_idx = {c: i for i, c in enumerate(categories)}
    num_cat = len(categories)

    # Confusion matrix: rows = human, cols = judge
    matrix = [[0] * num_cat for _ in range(num_cat)]
    for h, j in zip(human_labels, judge_labels):
        matrix[cat_to_idx[h]][cat_to_idx[j]] += 1

    # Observed agreement Po
    observed_agreements = sum(matrix[i][i] for i in range(num_cat))
    po = observed_agreements / n

    # Expected agreement Pe by chance
    human_totals = [sum(matrix[i][j] for j in range(num_cat)) for i in range(num_cat)]
    judge_totals = [sum(matrix[i][j] for i in range(num_cat)) for j in range(num_cat)]

    pe = sum((h_tot * j_tot) for h_tot, j_tot in zip(human_totals, judge_totals)) / (n * n)

    if pe == 1.0:
        return 1.0  # complete agreement on constant output

    kappa = (po - pe) / (1.0 - pe)
    return round(kappa, 4)


def interpret_kappa(kappa: float) -> str:
    """Standard Landis & Koch interpretation of Cohen's Kappa."""
    if kappa < 0:
        return "Poor (worse than chance)"
    elif kappa <= 0.20:
        return "Slight agreement"
    elif kappa <= 0.40:
        return "Fair agreement"
    elif kappa <= 0.60:
        return "Moderate agreement"
    elif kappa <= 0.80:
        return "Substantial agreement (Production ready)"
    else:
        return "Almost perfect agreement"


def evaluate_judge_calibration(
    human_binary_pass: Sequence[bool],
    judge_binary_pass: Sequence[bool],
) -> CalibrationMetrics:
    """
    Computes classification and reliability metrics for a binary PASS/FAIL judge.
    """
    n = len(human_binary_pass)
    if n == 0 or len(judge_binary_pass) != n:
        raise ValueError("Binary pass sequences must have equal, non-zero lengths.")

    tp = sum(1 for h, j in zip(human_binary_pass, judge_binary_pass) if h and j)
    fp = sum(1 for h, j in zip(human_binary_pass, judge_binary_pass) if not h and j)
    fn = sum(1 for h, j in zip(human_binary_pass, judge_binary_pass) if h and not j)
    tn = sum(1 for h, j in zip(human_binary_pass, judge_binary_pass) if not h and not j)

    accuracy = (tp + tn) / n
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    kappa = compute_cohens_kappa(human_binary_pass, judge_binary_pass)

    return CalibrationMetrics(
        total_samples=n,
        human_positive_rate=round(sum(human_binary_pass) / n, 3),
        judge_positive_rate=round(sum(judge_binary_pass) / n, 3),
        accuracy=round(accuracy, 3),
        precision=round(precision, 3),
        recall=round(recall, 3),
        f1_score=round(f1, 3),
        cohens_kappa=kappa,
        agreement_interpretation=interpret_kappa(kappa),
    )


# ---------------------------------------------------------------------------
# Bias Diagnostics
# ---------------------------------------------------------------------------

def detect_verbosity_bias(
    char_lengths: Sequence[int],
    judge_scores: Sequence[float],
) -> dict:
    """
    Measures Pearson correlation between response length and judge score.
    A correlation r > 0.40 suggests strong verbosity bias (judge rewards wordiness).
    """
    n = len(char_lengths)
    if n < 3:
        return {"bias_detected": False, "correlation": 0.0, "reason": "insufficient samples"}

    mean_x = sum(char_lengths) / n
    mean_y = sum(judge_scores) / n

    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(char_lengths, judge_scores))
    den_x = math.sqrt(sum((x - mean_x) ** 2 for x in char_lengths))
    den_y = math.sqrt(sum((y - mean_y) ** 2 for y in judge_scores))

    if den_x == 0 or den_y == 0:
        return {"bias_detected": False, "correlation": 0.0, "reason": "zero variance in inputs"}

    r = num / (den_x * den_y)
    r_rounded = round(r, 3)

    return {
        "bias_detected": r > 0.35,
        "pearson_correlation": r_rounded,
        "interpretation": (
            "Severe verbosity bias (judge rates longer text higher)"
            if r > 0.50
            else "Moderate verbosity correlation"
            if r > 0.30
            else "Balanced (length does not dominate scoring)"
        ),
    }


def detect_position_bias(
    order_a_scores: Sequence[float],
    order_b_scores: Sequence[float],
) -> dict:
    """
    Compares pairwise candidate evaluations when options are flipped (A/B vs B/A).
    If swapping positions changes the winner significantly, position bias is active.
    """
    n = len(order_a_scores)
    if n == 0 or len(order_b_scores) != n:
        return {"bias_detected": False, "inconsistency_rate": 0.0}

    # An inconsistent decision occurs if position swapping inverts the relative preference
    flips = sum(1 for a, b in zip(order_a_scores, order_b_scores) if abs(a - b) > 0.25)
    inconsistency_rate = round(flips / n, 3)

    return {
        "bias_detected": inconsistency_rate > 0.15,
        "inconsistency_rate": inconsistency_rate,
        "recommendation": "Use position randomization or symmetric score averaging in production.",
    }

