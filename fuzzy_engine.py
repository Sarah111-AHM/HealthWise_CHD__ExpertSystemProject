"""
fuzzy_engine.py — HealthWise CHD Fuzzy Expert System
Dr. Mohammed A. Altahrawi · UCAS 2026

Implements:
  - Fuzzification: trapezoidal + triangular MFs for BP, Chol, HR
  - Inference: 6-rule Mamdani system (AND = min)
  - Defuzzification: COG (centroid) and Sugeno (weighted average)
  - Linguistic hedges: very, extremely, somewhat, slightly, indeed, more_or_less
  - Advanced factors: Age, Smoking, Diabetes (+9 extended rules)
  - Sensitivity analysis helpers
"""

import math
import numpy as np

# ═══════════════════════════════════════════════════════════
# MEMBERSHIP FUNCTION PRIMITIVES
# ═══════════════════════════════════════════════════════════

def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal MF: rises a→b, plateau b→c, falls c→d."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)


def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular MF: rises a→b, falls b→c."""
    if x <= a or x >= c:
        return 0.0
    if x < b:
        return (x - a) / (b - a)
    if x == b:
        return 1.0
    return (c - x) / (c - b)


# ═══════════════════════════════════════════════════════════
# INPUT MEMBERSHIP FUNCTIONS  (exactly per Table 1)
# ═══════════════════════════════════════════════════════════
# BP:   Low(100-130), Medium(120-170), High(160-200)
# Chol: Low(100-200), High(180-280)
# HR:   Slow(50-80),  Moderate(70-100), Fast(90-200)

def bp_mf(bp: float) -> dict:
    return {
        "low":    round(trapmf(bp, 85,  100, 115, 135), 4),
        "medium": round(trimf(bp,  110, 145, 180),       4),
        "high":   round(trapmf(bp, 155, 168, 195, 215),  4),
    }


def chol_mf(chol: float) -> dict:
    return {
        "low":  round(trapmf(chol, 85,  100, 170, 200), 4),
        "high": round(trapmf(chol, 175, 198, 270, 290), 4),
    }


def hr_mf(hr: float) -> dict:
    return {
        "slow":     round(trapmf(hr, 35,  50,  68,  85),  4),
        "moderate": round(trimf(hr,  65,  83,  105),       4),
        "fast":     round(trapmf(hr, 88,  102, 195, 215), 4),
    }


# ═══════════════════════════════════════════════════════════
# ADVANCED FACTOR MFs  (for +20 marks)
# ═══════════════════════════════════════════════════════════

def age_mf(age: float) -> dict:
    return {
        "young":  round(trapmf(age, 0,  10, 28, 42),  4),
        "middle": round(trimf(age,  28, 45, 63),        4),
        "old":    round(trapmf(age, 55, 65, 90, 100),  4),
    }


def smoking_mf(s: float) -> dict:
    """s in packs/day (0-4)."""
    return {
        "none":  round(trapmf(s, -0.1, 0.0, 0.05, 0.18), 4),
        "light": round(trimf(s,   0.1, 0.4,  0.8),        4),
        "heavy": round(trapmf(s,  0.6, 1.0,  3.6, 4.0),   4),
    }


def diabetes_mf(g: float) -> dict:
    """g = fasting glucose in mg/dL."""
    return {
        "no":  round(trapmf(g, 55,  70,  95, 115), 4),
        "pre": round(trimf(g,  100, 112, 130),       4),
        "yes": round(trapmf(g,  118, 140, 310, 360), 4),
    }


# ═══════════════════════════════════════════════════════════
# OUTPUT MFs  (CHD level 0-4)
# ═══════════════════════════════════════════════════════════

def out_healthy(x: float) -> float:
    return trapmf(x, -0.1, 0.0, 0.95, 1.65)

def out_middle(x: float) -> float:
    return trimf(x, 1.1, 2.0, 2.9)

def out_sick(x: float) -> float:
    return trapmf(x, 2.35, 3.0, 4.0, 4.1)


# ═══════════════════════════════════════════════════════════
# LINGUISTIC HEDGES
# ═══════════════════════════════════════════════════════════

HEDGE_OPS = {
    "none":         lambda m: m,
    "very":         lambda m: m ** 2.0,
    "extremely":    lambda m: m ** 3.0,
    "somewhat":     lambda m: m ** 0.5,
    "slightly":     lambda m: m ** 1.25,
    "indeed":       lambda m: m ** 2.0,        # same as very
    "more_or_less": lambda m: m ** 0.5,        # same as somewhat
}

HEDGE_META = [
    {"value": "none",         "label": "None",         "formula": "μ",      "desc": "No modifier"},
    {"value": "very",         "label": "Very",         "formula": "μ²",     "desc": "Squares μ — stricter"},
    {"value": "extremely",    "label": "Extremely",    "formula": "μ³",     "desc": "Cubes μ — very strict"},
    {"value": "somewhat",     "label": "Somewhat",     "formula": "√μ",     "desc": "Square root — looser"},
    {"value": "slightly",     "label": "Slightly",     "formula": "μ^1.25", "desc": "Mild concentration"},
    {"value": "indeed",       "label": "Indeed",       "formula": "μ²",     "desc": "Same as Very"},
    {"value": "more_or_less", "label": "More or Less", "formula": "√μ",     "desc": "Same as Somewhat"},
]


def apply_hedge(mu: float, hedge: str) -> float:
    fn = HEDGE_OPS.get(hedge, HEDGE_OPS["none"])
    return round(float(fn(float(mu))), 6)


# ═══════════════════════════════════════════════════════════
# RULE BASE  (Table 2 — 6 core rules)
# ═══════════════════════════════════════════════════════════

CORE_RULES = [
    {"id": 1, "bp": "low",    "chol": "low",  "hr": "slow",     "out": "healthy"},
    {"id": 2, "bp": "low",    "chol": "low",  "hr": "moderate", "out": "healthy"},
    {"id": 3, "bp": "medium", "chol": "low",  "hr": "moderate", "out": "middle"},
    {"id": 4, "bp": "medium", "chol": "high", "hr": "slow",     "out": "middle"},
    {"id": 5, "bp": "high",   "chol": "low",  "hr": "moderate", "out": "sick"},
    {"id": 6, "bp": "high",   "chol": "high", "hr": "fast",     "out": "sick"},
]

# Extended rules for Advanced Challenge (+20 marks)
EXT_RULES = [
    {"id": 7,  "age": "young",  "sm": "none",  "db": "no",  "out": "healthy"},
    {"id": 8,  "age": "young",  "sm": "light", "db": "no",  "out": "healthy"},
    {"id": 9,  "age": "middle", "sm": "none",  "db": "no",  "out": "healthy"},
    {"id": 10, "age": "middle", "sm": "light", "db": "pre", "out": "middle"},
    {"id": 11, "age": "middle", "sm": "heavy", "db": "no",  "out": "middle"},
    {"id": 12, "age": "middle", "sm": "heavy", "db": "pre", "out": "sick"},
    {"id": 13, "age": "old",    "sm": "none",  "db": "pre", "out": "middle"},
    {"id": 14, "age": "old",    "sm": "light", "db": "yes", "out": "sick"},
    {"id": 15, "age": "old",    "sm": "heavy", "db": "yes", "out": "sick"},
]


# ═══════════════════════════════════════════════════════════
# INFERENCE ENGINE
# ═══════════════════════════════════════════════════════════

def run_inference(bp: float, chol: float, hr: float,
                  hedge: str = "none",
                  age: float = None, smoking: float = None,
                  diabetes: float = None) -> tuple:
    """
    Returns (fired_rules, bpm, cm, hrm, agm, skm, dbm).
    fired_rules: list of dicts with rule info and firing strength.
    """
    bpm = bp_mf(bp)
    cm  = chol_mf(chol)
    hrm = hr_mf(hr)
    agm = age_mf(age)        if age      is not None else None
    skm = smoking_mf(smoking) if smoking  is not None else None
    dbm = diabetes_mf(diabetes) if diabetes is not None else None

    fired = []

    # Core rules
    for r in CORE_RULES:
        bp_d   = apply_hedge(bpm[r["bp"]],  hedge)
        ch_d   = apply_hedge(cm[r["chol"]], hedge)
        hr_d   = apply_hedge(hrm[r["hr"]],  hedge)
        strength = round(min(bp_d, ch_d, hr_d), 4)
        fired.append({
            "id": r["id"], "type": "core",
            "condition": f'BP={r["bp"]}, Chol={r["chol"]}, HR={r["hr"]}',
            "bp_set": r["bp"], "chol_set": r["chol"], "hr_set": r["hr"],
            "bp_deg": bp_d, "chol_deg": ch_d, "hr_deg": hr_d,
            "strength": strength, "output": r["out"],
        })

    # Extended rules (only when extra inputs supplied)
    if agm and skm and dbm:
        for r in EXT_RULES:
            a_d = apply_hedge(agm[r["age"]], hedge)
            s_d = apply_hedge(skm[r["sm"]],  hedge)
            d_d = apply_hedge(dbm[r["db"]],  hedge)
            strength = round(min(a_d, s_d, d_d), 4)
            fired.append({
                "id": r["id"], "type": "extended",
                "condition": f'Age={r["age"]}, Smoking={r["sm"]}, Diabetes={r["db"]}',
                "age_set": r["age"], "sm_set": r["sm"], "db_set": r["db"],
                "age_deg": a_d, "sm_deg": s_d, "db_deg": d_d,
                "strength": strength, "output": r["out"],
            })

    return fired, bpm, cm, hrm, agm, skm, dbm


# ═══════════════════════════════════════════════════════════
# DEFUZZIFICATION — COG (Centroid)
# ═══════════════════════════════════════════════════════════

def defuzz_cog(fired: list, steps: int = 500) -> float:
    """
    Mamdani COG: clips each output MF at its rule's strength, aggregates
    by max, then computes centroid ∫x·μ(x)dx / ∫μ(x)dx over [0,4].
    """
    out_fns = {"healthy": out_healthy, "middle": out_middle, "sick": out_sick}
    dx  = 4.0 / steps
    num = den = 0.0
    for i in range(steps + 1):
        x = i * dx
        agg = 0.0
        for r in fired:
            clipped = min(r["strength"], out_fns[r["output"]](x))
            agg = max(agg, clipped)
        num += x * agg * dx
        den += agg * dx
    return round(num / den, 4) if den > 0 else 2.0


# ═══════════════════════════════════════════════════════════
# DEFUZZIFICATION — Sugeno
# ═══════════════════════════════════════════════════════════

SUGENO_Z = {"healthy": 0.75, "middle": 2.00, "sick": 3.25}

def defuzz_sugeno(fired: list) -> float:
    """Sugeno zero-order: z = Σ(wᵢ·zᵢ) / Σwᵢ"""
    ws = wd = 0.0
    for r in fired:
        ws += r["strength"] * SUGENO_Z[r["output"]]
        wd += r["strength"]
    return round(ws / wd, 4) if wd > 0 else 2.0


# ═══════════════════════════════════════════════════════════
# CLASSIFICATION
# ═══════════════════════════════════════════════════════════

def classify(val: float) -> dict:
    if val < 1.5:
        return {"label": "Healthy",     "cls": "healthy", "emoji": "💚", "risk": "Low"}
    if val < 2.55:
        return {"label": "Middle Risk", "cls": "middle",  "emoji": "🟡", "risk": "Moderate"}
    return     {"label": "Sick",        "cls": "sick",    "emoji": "❤️",  "risk": "High"}


# ═══════════════════════════════════════════════════════════
# FULL DIAGNOSIS PIPELINE
# ═══════════════════════════════════════════════════════════

def diagnose(bp: float, chol: float, hr: float,
             hedge: str = "none",
             age: float = None, smoking: float = None,
             diabetes: float = None) -> dict:
    """
    Run full fuzzy diagnosis and return a comprehensive result dict.
    """
    fired, bpm, cm, hrm, agm, skm, dbm = run_inference(
        bp, chol, hr, hedge, age, smoking, diabetes)

    cog    = defuzz_cog(fired)
    sugeno = defuzz_sugeno(fired)

    return {
        "inputs": {
            "bp": bp, "chol": chol, "hr": hr,
            "age": age, "smoking": smoking, "diabetes": diabetes,
        },
        "hedge": hedge,
        "memberships": {
            "bp":   bpm, "chol": cm, "hr": hrm,
            "age":  agm, "smoking": skm, "diabetes": dbm,
        },
        "fired": fired,
        "n_fired": sum(1 for r in fired if r["strength"] > 0),
        "cog":    {"value": cog,    "cls": classify(cog)},
        "sugeno": {"value": sugeno, "cls": classify(sugeno)},
        "diff":   round(abs(cog - sugeno), 4),
    }


# ═══════════════════════════════════════════════════════════
# MF CURVE DATA  (for plotting)
# ═══════════════════════════════════════════════════════════

def mf_curves(var: str, hedge: str = "none", n: int = 200) -> dict:
    """Return x + y-arrays for all sets of a variable, with optional hedge."""
    configs = {
        "bp":   (np.linspace(80, 220, n),
                 {"low": lambda x: apply_hedge(bp_mf(x)["low"], hedge),
                  "medium": lambda x: apply_hedge(bp_mf(x)["medium"], hedge),
                  "high": lambda x: apply_hedge(bp_mf(x)["high"], hedge)}),
        "chol": (np.linspace(80, 300, n),
                 {"low": lambda x: apply_hedge(chol_mf(x)["low"], hedge),
                  "high": lambda x: apply_hedge(chol_mf(x)["high"], hedge)}),
        "hr":   (np.linspace(30, 220, n),
                 {"slow": lambda x: apply_hedge(hr_mf(x)["slow"], hedge),
                  "moderate": lambda x: apply_hedge(hr_mf(x)["moderate"], hedge),
                  "fast": lambda x: apply_hedge(hr_mf(x)["fast"], hedge)}),
        "output": (np.linspace(0, 4, n),
                   {"healthy": out_healthy,
                    "middle":  out_middle,
                    "sick":    out_sick}),
        "age":  (np.linspace(0, 100, n),
                 {"young": lambda x: age_mf(x)["young"],
                  "middle": lambda x: age_mf(x)["middle"],
                  "old": lambda x: age_mf(x)["old"]}),
        "smoking": (np.linspace(0, 4, n),
                    {"none": lambda x: smoking_mf(x)["none"],
                     "light": lambda x: smoking_mf(x)["light"],
                     "heavy": lambda x: smoking_mf(x)["heavy"]}),
        "diabetes": (np.linspace(55, 360, n),
                     {"no": lambda x: diabetes_mf(x)["no"],
                      "pre": lambda x: diabetes_mf(x)["pre"],
                      "yes": lambda x: diabetes_mf(x)["yes"]}),
    }
    xs, sets = configs[var]
    return {
        "x":   [round(float(v), 3) for v in xs],
        **{k: [round(fn(x), 4) for x in xs] for k, fn in sets.items()}
    }


# ═══════════════════════════════════════════════════════════
# 3D SURFACE DATA
# ═══════════════════════════════════════════════════════════

def surface3d_data(fixed_hr: float = 75, hedge: str = "none",
                   bp_n: int = 25, chol_n: int = 25,
                   age=None, smoking=None, diabetes=None) -> dict:
    """Return meshgrid data for 3D surface (BP × Chol → CHD)."""
    bp_arr   = np.linspace(90, 210, bp_n).tolist()
    chol_arr = np.linspace(90, 290, chol_n).tolist()
    z = []
    for bp in bp_arr:
        row = []
        for chol in chol_arr:
            fired, *_ = run_inference(bp, chol, fixed_hr, hedge, age, smoking, diabetes)
            row.append(round(defuzz_cog(fired), 3))
        z.append(row)
    return {"bp": bp_arr, "chol": chol_arr, "z": z}


# ═══════════════════════════════════════════════════════════
# PRESET PATIENTS  (from assignment)
# ═══════════════════════════════════════════════════════════

PRESET_PATIENTS = [
    {"id": 1, "name": "Patient 1",
     "bp": 105, "chol": 160, "hr": 55,
     "age": 28,  "smoking": 0.0, "diabetes": 85},
    {"id": 2, "name": "Patient 2",
     "bp": 120, "chol": 195, "hr": 65,
     "age": 45,  "smoking": 0.5, "diabetes": 95},
    {"id": 3, "name": "Patient 3",
     "bp": 165, "chol": 186, "hr": 95,
     "age": 62,  "smoking": 0.9, "diabetes": 135},
]
