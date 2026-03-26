"""
Clinical Sensitivity & Impact Analysis.
Evaluates the marginal influence of physiological and behavioral factors 
on the final CHD risk score.
"""

import numpy as np
from fuzzy_engine import execute_inference, calculate_final_score, calculate_weighted_average

# Reference Patient Profile for Differential Analysis
CLINICAL_BASELINE = {
    "bp": 130, "chol": 190, "hr": 75,
    "age": 45, "smoking": 0.5, "glucose": 110,
}

# Operational bounds for parametric sweeping (min, max, resolution)
PARAMETER_SWEEP_CONFIG = {
    "bp":      (85,  210, 50, "Blood Pressure (mmHg)"),
    "chol":    (85,  295, 50, "Total Cholesterol (mg/dL)"),
    "hr":      (35,  210, 50, "Heart Rate (bpm)"),
    "age":     (5,   95,  50, "Patient Age (years)"),
    "smoking": (0.0, 3.8, 50, "Smoking Intensity (packs/day)"),
    "glucose": (60,  340, 50, "Fasting Glucose (mg/dL)"),
}

def analyze_factor_impact(baseline=None, intensity_modifier="none"):
    """
    Performs a differential sensitivity sweep across all clinical parameters.
    Identifies the 'Primary Risk Driver' by measuring output variance.
    """
    if baseline is None:
        baseline = CLINICAL_BASELINE.copy()

    impact_results = {}
    variance_metrics = {}

    for factor, (min_val, max_val, steps, label) in PARAMETER_SWEEP_CONFIG.items():
        x_axis = np.linspace(min_val, max_val, steps).tolist()
        centroid_trace = []
        weighted_trace = []

        for val in x_axis:
            # Create a localized test case by varying one parameter at a time
            test_case = dict(baseline)
            test_case[factor] = float(val)
            
            # Execute inference logic
            active_rules, _ = execute_inference(
                test_case["bp"], test_case["chol"], test_case["hr"], 
                intensity_modifier,
                test_case["age"], test_case["smoking"], test_case["glucose"]
            )
            
            # Calculate scores using both methodologies
            c_score = calculate_final_score(active_rules)
            w_score = calculate_weighted_average(active_rules)
            
            centroid_trace.append(round(c_score, 3))
            weighted_trace.append(round(w_score, 3))

        # Quantify the sensitivity (Max Delta)
        impact_range = round(max(centroid_trace) - min(centroid_trace), 4)
        
        impact_results[factor] = {
            "coordinates": x_axis,
            "centroid_path": centroid_trace,
            "weighted_path": weighted_trace,
            "display_label": label,
            "sensitivity_index": impact_range,
        }
        variance_metrics[factor] = impact_range

    # Determine the most influential clinical driver
    primary_driver = max(variance_metrics, key=variance_metrics.get)
    
    # Generate ranked impact hierarchy
    impact_ranking = sorted(
        variance_metrics.items(), 
        key=lambda x: x[1], 
        reverse=True
    )

    return {
        "analysis_grid":     impact_results,
        "primary_driver":    primary_driver,
        "impact_ranking":    impact_ranking,
        "baseline_profile":  baseline,
            }
    
