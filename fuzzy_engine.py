"""
Core Inference Engine for CHD Risk Assessment.
Handles fuzzy logic primitives and linguistic processing.
"""

import math
import numpy as np

# ---------------------------------------------------------
# Membership Functions (MF) - Logic Layer
# ---------------------------------------------------------

def trapmf(x, a, b, c, d):
    """Calculates trapezoidal membership value."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / float(b - a)
    return (d - x) / float(d - c)


def trimf(x, a, b, c):
    """Calculates triangular membership value."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / float(b - a)
    return (c - x) / float(c - b)

# ---------------------------------------------------------

# ---------------------------------------------------------
# Clinical Input Processing (Fuzzification)
# Definitions for: Blood Pressure, Cholesterol, Heart Rate
# ---------------------------------------------------------

def get_bp_levels(bp):
    """Assess membership for Blood Pressure ranges."""
    return {
        "low":    round(trapmf(bp, 85, 100, 115, 135), 4),
        "medium": round(trimf(bp, 110, 145, 180), 4),
        "high":   round(trapmf(bp, 155, 168, 195, 215), 4),
    }

def get_cholesterol_levels(chol):
    """Assess membership for Cholesterol levels."""
    return {
        "low":  round(trapmf(chol, 85, 100, 170, 200), 4),
        "high": round(trapmf(chol, 175, 198, 270, 290), 4),
    }

def get_hr_levels(hr):
    """Assess membership for Heart Rate metrics."""
    return {
        "slow":     round(trapmf(hr, 35, 50, 68, 85), 4),
        "moderate": round(trimf(hr, 65, 83, 105), 4),
        "fast":     round(trapmf(hr, 88, 102, 195, 215), 4),
  }
  


# ═══════════════════════════════════════════════════════════

# ---------------------------------------------------------
# Clinical Indicators & Patient Risk Profiles
# Handling Age, Smoking habits, and Glucose levels
# ---------------------------------------------------------

def assess_age_group(age):
    """Categorizes patient risk based on age brackets."""
    return {
        "young":  round(trapmf(age, 0,  10, 28, 42),  4),
        "middle": round(trimf(age,  28, 45, 63),       4),
        "old":    round(trapmf(age, 55, 65, 90, 100),  4),
    }

def assess_smoking_intensity(packs_per_day):
    """Evaluates smoking risk based on daily pack consumption."""
    return {
        "none":  round(trapmf(packs_per_day, -0.1, 0.0, 0.05, 0.18), 4),
        "light": round(trimf(packs_per_day,   0.1, 0.4,  0.8),        4),
        "heavy": round(trapmf(packs_per_day,  0.6, 1.0,  3.6, 4.0),   4),
    }

def assess_diabetic_status(glucose_level):
    """Fasting glucose analysis (mg/dL) for diabetic profiling."""
    return {
        "no":  round(trapmf(glucose_level, 55,  70,  95, 115), 4),
        "pre": round(trimf(glucose_level,  100, 112, 130),       4),
        "yes": round(trapmf(glucose_level,  118, 140, 310, 360), 4),
    }


# ---------------------------------------------------------
# Diagnostic Risk Classification (Output Scale 0-4)
# ---------------------------------------------------------

def risk_level_healthy(score):
    """Low risk / Optimal cardiac health profile."""
    return trapmf(score, -0.1, 0.0, 0.95, 1.65)

def risk_level_intermediate(score):
    """Moderate risk / Clinical monitoring recommended."""
    return trimf(score, 1.1, 2.0, 2.9)

def risk_level_critical(score):
    """High risk / Significant CHD indicators present."""
    return trapmf(score, 2.35, 3.0, 4.0, 4.1)


# ---------------------------------------------------------
# Clinical Intensity Modifiers (Linguistic Hedges)
# ---------------------------------------------------------

# Intensity scaling factors for linguistic precision
MODIFIER_MAP = {
    "none":         1.0,
    "very":         2.0,    # Concentration
    "extremely":    3.0,    # High Concentration
    "somewhat":     0.5,    # Dilation
    "slightly":     1.25,   # Mild shift
    "indeed":       2.0,    # Alias for 'very'
    "more_or_less": 0.5,    # Alias for 'somewhat'
}

def apply_clinical_hedge(membership_value, intensity_label):
    """
    Adjusts the membership degree based on clinical nuance.
    Uses concentration/dilation principles.
    """
    power = MODIFIER_MAP.get(intensity_label, 1.0)
    
    # Apply power-based scaling (Zadeh's operators)
    result = math.pow(float(membership_value), power)
    return round(result, 6)

# Metadata for UI rendering (Simplified)
UI_MODIFIERS = [
    {"id": "none",         "label": "Standard"},
    {"id": "very",         "label": "Very"},
    {"id": "extremely",    "label": "Extremely"},
    {"id": "somewhat",     "label": "Somewhat"},
    {"id": "slightly",     "label": "Slightly"},
    {"id": "indeed",       "label": "Indeed"},
    {"id": "more_or_less", "label": "More or Less"},
]


# ---------------------------------------------------------
# KNOWLEDGE BASE: CLINICAL DECISION RULES
# Definitions for core diagnostics and expanded risk factors.
# ---------------------------------------------------------

# Primary Clinical Rules (Physiological Indicators)
PRIMARY_RULESET = [
    {"id": 1, "bp": "low",    "chol": "low",  "hr": "slow",     "result": "healthy"},
    {"id": 2, "bp": "low",    "chol": "low",  "hr": "moderate", "result": "healthy"},
    {"id": 3, "bp": "medium", "chol": "low",  "hr": "moderate", "result": "intermediate"},
    {"id": 4, "bp": "medium", "chol": "high", "hr": "slow",     "result": "intermediate"},
    {"id": 5, "bp": "high",   "chol": "low",  "hr": "moderate", "result": "critical"},
    {"id": 6, "bp": "high",   "chol": "high", "hr": "fast",     "result": "critical"},
]

# Demographic & Behavioral Risk Factors (Expanded Profile)
EXPANDED_RISK_LOGIC = [
    {"id": 7,  "age": "young",  "smoking": "none",  "diabetes": "no",  "result": "healthy"},
    {"id": 8,  "age": "young",  "smoking": "light", "diabetes": "no",  "result": "healthy"},
    {"id": 9,  "age": "middle", "smoking": "none",  "diabetes": "no",  "result": "healthy"},
    {"id": 10, "age": "middle", "smoking": "light", "diabetes": "pre", "result": "intermediate"},
    {"id": 11, "age": "middle", "smoking": "heavy", "diabetes": "no",  "result": "intermediate"},
    {"id": 12, "age": "middle", "smoking": "heavy", "diabetes": "pre", "result": "critical"},
    {"id": 13, "age": "old",    "age": "none",      "diabetes": "pre", "result": "intermediate"},
    {"id": 14, "age": "old",    "smoking": "light", "diabetes": "yes", "result": "critical"},
    {"id": 15, "age": "old",    "smoking": "heavy", "diabetes": "yes", "result": "critical"},
]

# ═══════════════════════════════════════════════════════════
# ---------------------------------------------------------
# INFERENCE ENGINE: RULE ACTIVATION & STRENGTH CALCULATION
# Executes core clinical logic and expanded risk assessment.
# ---------------------------------------------------------

def execute_inference(bp_val, chol_val, hr_val, hedge="none", 
                      age_val=None, smoking_val=None, glucose_val=None):
    """
    Core engine to activate rules and calculate firing strengths.
    Returns: (active_rules, all_memberships)
    """
    # 1. Map Inputs to Membership Degrees
    m_bp   = get_bp_levels(bp_val)
    m_chol = get_cholesterol_levels(chol_val)
    m_hr   = get_hr_levels(hr_val)
    
    # Optional Risk Factors
    m_age     = assess_age_group(age_val)          if age_val     is not None else None
    m_smoking = assess_smoking_intensity(smoking_val) if smoking_val is not None else None
    m_diabetes = assess_diabetic_status(glucose_val)   if glucose_val is not None else None

    active_rules = []

    # 2. Process Primary Clinical Rules
    for rule in PRIMARY_RULESET:
        # Resolve degree with linguistic hedge
        d_bp   = apply_clinical_hedge(m_bp[rule["bp"]],   hedge)
        d_chol = apply_clinical_hedge(m_chol[rule["chol"]], hedge)
        d_hr   = apply_clinical_hedge(m_hr[rule["hr"]],   hedge)
        
        # Rule Firing Strength (Mamdani Min-Inference)
        strength = round(min(d_bp, d_chol, d_hr), 4)
        
        active_rules.append({
            "id": rule["id"],
            "category": "primary",
            "strength": strength,
            "outcome": rule["result"],
            "details": f"BP:{rule['bp']} & Chol:{rule['chol']} & HR:{rule['hr']}"
        })

    # 3. Process Behavioral/Demographic Risk Rules
    if all([m_age, m_smoking, m_diabetes]):
        for rule in EXPANDED_RISK_LOGIC:
            d_age = apply_clinical_hedge(m_age[rule["age"]],      hedge)
            d_smk = apply_clinical_hedge(m_smoking[rule["smoking"]], hedge)
            d_db  = apply_clinical_hedge(m_diabetes[rule["diabetes"]], hedge)
            
            strength = round(min(d_age, d_smk, d_db), 4)
            
            active_rules.append({
                "id": rule["id"],
                "category": "expanded",
                "strength": strength,
                "outcome": rule["result"],
                "details": f"Age:{rule['age']} & Smoking:{rule['smoking']} & Glucose:{rule['diabetes']}"
            })

    # Consolidate all membership data for downstream analysis
    memberships = {
        "bp": m_bp, "chol": m_chol, "hr": m_hr,
        "age": m_age, "smoking": m_smoking, "diabetes": m_diabetes
    }

    return active_rules, memberships
      
# ---------------------------------------------------------
# RISK QUANTIFICATION (Defuzzification - Centroid Method)
# ---------------------------------------------------------

def calculate_final_score(active_rules, resolution=500):
    """
    Computes the weighted Risk Score (0-4) using the Centroid (CoG) approach.
    Aggregates clinical logic through numerical integration.
    """
    # Mapping outcome labels to their respective membership functions
    risk_profiles = {
        "healthy":      risk_level_healthy,
        "intermediate": risk_level_intermediate,
        "critical":     risk_level_critical
    }
    
    # Integration parameters over the 0-4 risk scale
    scale_min, scale_max = 0.0, 4.0
    step_size = (scale_max - scale_min) / resolution
    
    numerator = 0.0
    denominator = 0.0

    # Numerical integration across the risk spectrum
    for i in range(resolution + 1):
        x_val = scale_min + (i * step_size)
        aggregated_membership = 0.0
        
        # Aggregate fuzzy outputs (Mamdani max-min composition)
        for rule in active_rules:
            # Clip the output profile by the rule's activation strength
            membership_fn = risk_profiles.get(rule["outcome"])
            if membership_fn:
                clipped_value = min(rule["strength"], membership_fn(x_val))
                aggregated_membership = max(aggregated_membership, clipped_value)
        
        # Accumulate integrals
        numerator   += x_val * aggregated_membership
        denominator += aggregated_membership

    # Calculate centroid; default to 2.0 (Neutral/Medium) if no rules fire
    if denominator == 0:
        return 2.0
        
    final_score = numerator / denominator
    return round(final_score, 4)


# ---------------------------------------------------------
# RISK SCORING METHODOLOGIES (Sugeno & Weighted Average)
# ---------------------------------------------------------

# Fixed risk weights for zero-order weighted average
RISK_WEIGHTS = {
    "healthy":      0.75,
    "intermediate": 2.00,
    "critical":     3.25
}

def calculate_weighted_average(active_rules):
    """
    Computes a simplified risk score using weighted averaging (Sugeno-style).
    Provides a faster alternative to Centroid calculation.
    """
    weighted_sum = 0.0
    total_strength = 0.0
    
    for rule in active_rules:
        weight = RISK_WEIGHTS.get(rule["outcome"], 2.0)
        weighted_sum += rule["strength"] * weight
        total_strength += rule["strength"]
        
    if total_strength == 0:
        return 2.0
        
    return round(weighted_sum / total_strength, 4)


# ---------------------------------------------------------
# CLINICAL CLASSIFICATION & DIAGNOSTIC PIPELINE
# ---------------------------------------------------------

def categorize_risk_score(score):
    """Maps numerical risk scores to clinical status labels."""
    if score < 1.5:
        return {"label": "Optimal / Healthy", "status": "low_risk", "severity": "Low"}
    if score < 2.55:
        return {"label": "Intermediate Risk", "status": "moderate_risk", "severity": "Moderate"}
    
    return {"label": "Critical / High Risk", "status": "high_risk", "severity": "High"}


def run_diagnostic_pipeline(bp, chol, hr, hedge="none", 
                            age=None, smoking=None, glucose=None):
    """
    Executes the full diagnostic flow: 
    Fuzzification -> Inference -> Dual-method Scoring -> Classification.
    """
    # 1. Execute Inference Engine
    active_rules, memberships = execute_inference(
        bp, chol, hr, hedge, age, smoking, glucose
    )

    # 2. Calculate scores using two different methodologies for validation
    centroid_score = calculate_final_score(active_rules)
    weighted_score = calculate_weighted_average(active_rules)

    # 3. Consolidate Clinical Report
    return {
        "parameters": {
            "bp": bp, "chol": chol, "hr": hr,
            "age": age, "smoking": smoking, "glucose": glucose,
        },
        "intensity_modifier": hedge,
        "membership_degrees": memberships,
        "active_rules_count": sum(1 for r in active_rules if r["strength"] > 0),
        "primary_assessment": {
            "score": centroid_score, 
            "classification": categorize_risk_score(centroid_score)
        },
        "secondary_assessment": {
            "score": weighted_score, 
            "classification": categorize_risk_score(weighted_score)
        },
        "variance": round(abs(centroid_score - weighted_score), 4),
        "raw_rules": active_rules
    }
                              


# ---------------------------------------------------------
# VISUALIZATION UTILITIES: DISTRIBUTION DATA GENERATION
# Generates coordinate sets for clinical profile plotting.
# ---------------------------------------------------------

def generate_profile_coordinates(variable_name, modifier="none", resolution=200):
    """
    Generates X and Y coordinates for clinical variable distributions.
    Used for front-end rendering of membership curves.
    """
    # Define clinical ranges for each parameter
    domain_configs = {
        "bp":       (80, 220,  get_bp_levels),
        "chol":     (80, 300,  get_cholesterol_levels),
        "hr":       (30, 220,  get_hr_levels),
        "age":      (0, 100,   assess_age_group),
        "smoking":  (0, 4,     assess_smoking_intensity),
        "glucose":  (55, 360,  assess_diabetic_status),
        "output":   (0, 4,     None) # Special case for output scale
    }

    if variable_name not in domain_configs:
        return {}

    min_val, max_val, mapping_fn = domain_configs[variable_name]
    x_axis = np.linspace(min_val, max_val, resolution)
    
    response = {
        "x_axis": [round(float(v), 3) for v in x_axis]
    }

    # Handle standard input variables
    if mapping_fn:
        # Get labels from a sample call
        sample_labels = mapping_fn(min_val).keys()
        for label in sample_labels:
            y_values = []
            for x in x_axis:
                mu = mapping_fn(x)[label]
                # Apply clinical intensity modifier (hedge)
                adjusted_mu = apply_clinical_hedge(mu, modifier)
                y_values.append(round(adjusted_mu, 4))
            response[label] = y_values
            
    # Handle the risk scale output profiles
    else:
        output_profiles = {
            "healthy":      risk_level_healthy,
            "intermediate": risk_level_intermediate,
            "critical":     risk_level_critical
        }
        for label, fn in output_profiles.items():
            response[label] = [round(fn(x), 4) for x in x_axis]

    return response
                               

# ---------------------------------------------------------
# ANALYTICAL UTILITIES: 3D RISK SURFACE GENERATION
# Generates spatial data for BP x Cholesterol interaction.
# ---------------------------------------------------------

def generate_risk_surface(fixed_hr=75, modifier="none", 
                          grid_resolution=25, 
                          age=None, smoking=None, glucose=None):
    """
    Computes a 3D meshgrid for risk visualization (Blood Pressure vs. Cholesterol).
    Maps the interaction between physiological variables and the final CHD score.
    """
    bp_range   = np.linspace(90, 210, grid_resolution).tolist()
    chol_range = np.linspace(90, 290, grid_resolution).tolist()
    
    risk_matrix = []
    
    for bp in bp_range:
        row_data = []
        for chol in chol_range:
            # Execute inference for each coordinate in the grid
            active_rules, _ = execute_inference(
                bp, chol, fixed_hr, modifier, age, smoking, glucose
            )
            # Use Centroid method for high-precision surface mapping
            score = calculate_final_score(active_rules)
            row_data.append(round(score, 3))
        risk_matrix.append(row_data)

    return {
        "bp_axis": bp_range, 
        "chol_axis": chol_range, 
        "z_matrix": risk_matrix
    }


# ---------------------------------------------------------
# VALIDATION DATASETS: CLINICAL CASE STUDIES
# Representative patient profiles for system verification.
# ---------------------------------------------------------

CLINICAL_CASE_STUDIES = [
    {
        "case_id": "P-001", "description": "Baseline Low Risk",
        "bp": 105, "chol": 160, "hr": 55,
        "age": 28, "smoking": 0.0, "glucose": 85
    },
    {
        "case_id": "P-002", "description": "Borderline / Moderate Risk",
        "bp": 120, "chol": 195, "hr": 65,
        "age": 45, "smoking": 0.5, "glucose": 95
    },
    {
        "case_id": "P-003", "description": "High-Risk Clinical Profile",
        "bp": 165, "chol": 186, "hr": 95,
        "age": 62, "smoking": 0.9, "glucose": 135
    },
]
