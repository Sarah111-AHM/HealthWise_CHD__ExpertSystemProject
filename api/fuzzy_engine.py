"""
HealthWise Fuzzy Logic Engine
CHD Diagnostic Expert System
Dr. Mohammed A. Altahrawi — UCAS 2026
"""
import math


# ─────────────────────────────────────────────
# Membership Functions
# ─────────────────────────────────────────────

def trapmf(x, a, b, c, d):
    """Trapezoidal membership function."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)


def trimf(x, a, b, c):
    """Triangular membership function."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


# ─────────────────────────────────────────────
# Input Variable Membership Functions
# ─────────────────────────────────────────────

def bp_membership(bp):
    return {
        'low':    round(trapmf(bp,  80, 100, 120, 135), 4),
        'medium': round(trimf (bp, 115, 145, 175),      4),
        'high':   round(trapmf(bp, 160, 175, 200, 220), 4),
    }


def chol_membership(chol):
    return {
        'low':  round(trapmf(chol,  80, 100, 170, 195), 4),
        'high': round(trapmf(chol, 175, 200, 280, 300), 4),
    }


def hr_membership(hr):
    return {
        'slow':     round(trapmf(hr,  30,  50,  70,  85), 4),
        'moderate': round(trimf (hr,  65,  85, 105),      4),
        'fast':     round(trapmf(hr,  90, 110, 200, 220), 4),
    }


# ─────────────────────────────────────────────
# Output Membership Functions (CHD ∈ [0, 4])
# ─────────────────────────────────────────────

def out_healthy(x): return trapmf(x, -0.5, 0.0, 1.0, 1.8)
def out_middle(x):  return trimf (x,  1.0, 2.0, 3.0)
def out_sick(x):    return trapmf(x,  2.2, 3.0, 4.0, 4.5)

OUTPUT_FUNCS = {
    'healthy': out_healthy,
    'middle':  out_middle,
    'sick':    out_sick,
}

# Sugeno crisp centres
SUGENO_CENTRES = {'healthy': 0.75, 'middle': 2.0, 'sick': 3.25}


# ─────────────────────────────────────────────
# Rule Base (Table 2)
# ─────────────────────────────────────────────

RULES = [
    {'bp': 'low',    'chol': 'low',  'hr': 'slow',     'output': 'healthy'},
    {'bp': 'low',    'chol': 'low',  'hr': 'moderate', 'output': 'healthy'},
    {'bp': 'medium', 'chol': 'low',  'hr': 'moderate', 'output': 'middle'},
    {'bp': 'medium', 'chol': 'high', 'hr': 'slow',     'output': 'middle'},
    {'bp': 'high',   'chol': 'low',  'hr': 'moderate', 'output': 'sick'},
    {'bp': 'high',   'chol': 'high', 'hr': 'fast',     'output': 'sick'},
]


# ─────────────────────────────────────────────
# Linguistic Hedge Operators
# ─────────────────────────────────────────────

HEDGE_OPS = {
    'none':         lambda mu: mu,
    'very':         lambda mu: mu ** 2,
    'indeed':       lambda mu: mu ** 2,
    'extremely':    lambda mu: mu ** 3,
    'somewhat':     lambda mu: mu ** 0.5,
    'more_or_less': lambda mu: mu ** 0.5,
    'slightly':     lambda mu: mu ** 1.25,
}


def apply_hedge(mu, hedge='none'):
    fn = HEDGE_OPS.get(hedge, HEDGE_OPS['none'])
    return round(fn(mu), 4)


# ─────────────────────────────────────────────
# Inference Engine
# ─────────────────────────────────────────────

def inference_engine(bp, chol, hr):
    bp_m   = bp_membership(bp)
    chol_m = chol_membership(chol)
    hr_m   = hr_membership(hr)

    strengths = []
    for i, rule in enumerate(RULES):
        bp_deg   = bp_m.get(rule['bp'], 0.0)
        chol_deg = chol_m.get(rule['chol'], 0.0)
        hr_deg   = hr_m.get(rule['hr'], 0.0)
        strength = min(bp_deg, chol_deg, hr_deg)   # AND = min
        strengths.append({
            'rule':     i + 1,
            'bp':       rule['bp'],    'bp_deg':   bp_deg,
            'chol':     rule['chol'],  'chol_deg': chol_deg,
            'hr':       rule['hr'],    'hr_deg':   hr_deg,
            'output':   rule['output'],
            'strength': round(strength, 4),
        })
    return strengths, bp_m, chol_m, hr_m


# ─────────────────────────────────────────────
# Defuzzification — COG (Mamdani)
# ─────────────────────────────────────────────

def defuzzify_cog(rule_strengths, hedge='none', steps=400):
    x_min, x_max = 0.0, 4.0
    dx = (x_max - x_min) / steps
    numerator = denominator = 0.0

    for i in range(steps + 1):
        x = x_min + i * dx
        agg = 0.0
        for r in rule_strengths:
            s = apply_hedge(r['strength'], hedge)
            mu = OUTPUT_FUNCS[r['output']](x)
            agg = max(agg, min(s, mu))
        numerator   += x * agg * dx
        denominator += agg * dx

    return round(numerator / denominator, 4) if denominator > 0 else 2.0


# ─────────────────────────────────────────────
# Defuzzification — Sugeno
# ─────────────────────────────────────────────

def defuzzify_sugeno(rule_strengths, hedge='none'):
    weighted_sum = total_weight = 0.0
    for r in rule_strengths:
        s = apply_hedge(r['strength'], hedge)
        z = SUGENO_CENTRES[r['output']]
        weighted_sum  += s * z
        total_weight  += s
    return round(weighted_sum / total_weight, 4) if total_weight > 0 else 2.0


# ─────────────────────────────────────────────
# Classification
# ─────────────────────────────────────────────

def classify_chd(value):
    if value < 1.5:
        return {'label': 'Healthy',      'color': '#00ff9d', 'emoji': '💚', 'risk': 'Low'}
    if value < 2.7:
        return {'label': 'Middle Risk',  'color': '#ffb703', 'emoji': '🟡', 'risk': 'Moderate'}
    return     {'label': 'Sick',         'color': '#ff4d6d', 'emoji': '❤️',  'risk': 'High'}


# ─────────────────────────────────────────────
# Full Diagnosis
# ─────────────────────────────────────────────

def diagnose(bp, chol, hr, hedge='none'):
    rule_strengths, bp_m, chol_m, hr_m = inference_engine(bp, chol, hr)

    cog_val    = defuzzify_cog(rule_strengths, hedge)
    sugeno_val = defuzzify_sugeno(rule_strengths, hedge)

    return {
        'inputs': {'bp': bp, 'chol': chol, 'hr': hr},
        'memberships': {'bp': bp_m, 'chol': chol_m, 'hr': hr_m},
        'rule_strengths': rule_strengths,
        'cog':    {'value': cog_val,    'classification': classify_chd(cog_val)},
        'sugeno': {'value': sugeno_val, 'classification': classify_chd(sugeno_val)},
        'hedge': hedge,
    }


# ─────────────────────────────────────────────
# Membership Curve Data (for charts)
# ─────────────────────────────────────────────

def get_membership_curve(var_type, points=120):
    ranges = {
        'bp':     (80,  220),
        'chol':   (80,  300),
        'hr':     (30,  220),
        'output': (0.0, 4.0),
    }
    funcs = {
        'bp':     lambda x: bp_membership(x),
        'chol':   lambda x: chol_membership(x),
        'hr':     lambda x: hr_membership(x),
        'output': lambda x: {
            'healthy': out_healthy(x),
            'middle':  out_middle(x),
            'sick':    out_sick(x),
        },
    }
    lo, hi = ranges[var_type]
    step = (hi - lo) / points
    result = []
    for i in range(points + 1):
        x = lo + i * step
        row = {'x': round(x, 3)}
        row.update(funcs[var_type](x))
        result.append(row)
    return result


# ─────────────────────────────────────────────
# 3D Surface Data
# ─────────────────────────────────────────────

def generate_3d_surface(fixed_hr=75, bp_points=20, chol_points=20):
    bp_range   = [95 + i * 6  for i in range(bp_points)]
    chol_range = [95 + i * 10 for i in range(chol_points)]
    z = []
    for bp in bp_range:
        row = []
        for chol in chol_range:
            rs, *_ = inference_engine(bp, chol, fixed_hr)
            row.append(defuzzify_cog(rs))
        z.append(row)
    return {'bp': bp_range, 'chol': chol_range, 'z': z}


# ─────────────────────────────────────────────
# Preset Patients
# ─────────────────────────────────────────────

PRESET_PATIENTS = [
    {'id': 1, 'name': 'Patient 1', 'bp': 105, 'chol': 160, 'hr': 55},
    {'id': 2, 'name': 'Patient 2', 'bp': 120, 'chol': 195, 'hr': 65},
    {'id': 3, 'name': 'Patient 3', 'bp': 165, 'chol': 186, 'hr': 95},
]
