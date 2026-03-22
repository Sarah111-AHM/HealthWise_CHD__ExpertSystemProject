"""
sensitivity.py — Sensitivity Analysis for HealthWise CHD
Determines which factor most influences CHD output.
"""

import numpy as np
from fuzzy_engine import run_inference, defuzz_cog, defuzz_sugeno

# Base patient for sensitivity (mid-range values)
BASE_PATIENT = {
    "bp": 130, "chol": 190, "hr": 75,
    "age": 45, "smoking": 0.5, "diabetes": 110,
}

# Factor ranges (min, max, n_points)
FACTOR_RANGES = {
    "bp":       (85,  210, 50),
    "chol":     (85,  295, 50),
    "hr":       (35,  210, 50),
    "age":      (5,   95,  50),
    "smoking":  (0.0, 3.8, 50),
    "diabetes": (60,  340, 50),
}

FACTOR_LABELS = {
    "bp":       "Blood Pressure (mmHg)",
    "chol":     "Cholesterol (mg/dL)",
    "hr":       "Heart Rate (bpm)",
    "age":      "Age (years)",
    "smoking":  "Smoking (packs/day)",
    "diabetes": "Fasting Glucose (mg/dL)",
}


def run_sensitivity(base: dict = None, hedge: str = "none") -> dict:
    """
    Vary each factor from its range while keeping others at base values.
    Returns dict with x, y_cog, y_sugeno, range, most_influential.
    """
    if base is None:
        base = BASE_PATIENT.copy()

    results = {}
    ranges_cog = {}

    for factor, (lo, hi, n) in FACTOR_RANGES.items():
        xs = np.linspace(lo, hi, n).tolist()
        ys_cog  = []
        ys_sug  = []
        for xv in xs:
            kw = dict(base); kw[factor] = float(xv)
            fired, *_ = run_inference(
                kw["bp"], kw["chol"], kw["hr"], hedge,
                kw["age"], kw["smoking"], kw["diabetes"])
            ys_cog.append(round(defuzz_cog(fired),    3))
            ys_sug.append(round(defuzz_sugeno(fired), 3))
        results[factor] = {
            "x":       xs,
            "y_cog":   ys_cog,
            "y_sugeno":ys_sug,
            "label":   FACTOR_LABELS[factor],
            "range_cog": round(max(ys_cog) - min(ys_cog), 4),
        }
        ranges_cog[factor] = results[factor]["range_cog"]

    most_influential = max(ranges_cog, key=ranges_cog.get)

    # Sorted ranking
    ranking = sorted(ranges_cog.items(), key=lambda x: x[1], reverse=True)

    return {
        "factors":         results,
        "ranges_cog":      ranges_cog,
        "most_influential": most_influential,
        "ranking":         ranking,
        "base_patient":    base,
    }
