"""
Core Application Gateway - HealthWise CHD Expert System.
Handles clinical routing, parameter processing, and API orchestration.
"""

import os
import sys
from flask import Flask, render_template, request, jsonify

# Add current directory to path for proper imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Unified imports from our refactored modules
from fuzzy_engine import (
    run_diagnostic_pipeline, generate_profile_coordinates, generate_risk_surface,
    CLINICAL_CASE_STUDIES, UI_MODIFIERS, categorize_risk_score
)
from sensitivity import analyze_factor_impact, CLINICAL_BASELINE
import neuro_fuzzy as nf

# Initialize Flask app with explicit template and static folders
app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')

# ---------------------------------------------------------
# Utility: Safe Parameter Extraction
# ---------------------------------------------------------

def parse_float(value, default=None):
    """Safely converts input to float or returns default."""
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default

# ---------------------------------------------------------
# VIEW ROUTES (HTML Serving)
# ---------------------------------------------------------

@app.route("/")
def index():
    """Serves the primary clinical dashboard."""
    # Convert case studies to include ID for template
    patients_with_ids = []
    for idx, case in enumerate(CLINICAL_CASE_STUDIES, 1):
        case_copy = case.copy()
        case_copy['id'] = idx
        patients_with_ids.append(case_copy)
    
    return render_template(
        "index.html",
        patients=patients_with_ids,
        modifiers=UI_MODIFIERS,
    )

# ---------------------------------------------------------
# API ENDPOINTS: DIAGNOSTICS & INFERENCE
# ---------------------------------------------------------

@app.route("/api/diagnose", methods=["POST"])
def api_diagnose():
    """
    Executes a full diagnostic run based on patient physiological data.
    Payload: {bp, chol, hr, age?, smoking?, glucose?, hedge?}
    """
    payload = request.get_json(force=True) or {}

    # Extracting and normalizing clinical parameters
    bp      = parse_float(payload.get("bp"),       130.0)
    chol    = parse_float(payload.get("chol"),     190.0)
    hr      = parse_float(payload.get("hr"),        75.0)
    modifier = str(payload.get("hedge", "none"))
    
    # Optional Risk Factors
    age     = parse_float(payload.get("age"))
    smk     = parse_float(payload.get("smoking"))
    gluc    = parse_float(payload.get("glucose"))

    # Execute the primary inference engine
    report = run_diagnostic_pipeline(bp, chol, hr, modifier, age, smk, gluc)

    # Cross-reference with the Optimization Module (if calibrated)
    optimizer = nf.get_optimizer()
    if optimizer.is_initialized:
        try:
            approx_score = optimizer.estimate_risk(bp, chol, hr, age, smk, gluc)
            report["optimization_audit"] = {
                "score": approx_score, 
                "classification": categorize_risk_score(approx_score)
            }
        except Exception:
            # Non-blocking failure for optimization audit
            pass

    return jsonify(report)

# ---------------------------------------------------------
# ANALYTICAL SERVICES: VISUALIZATION DATA
# ---------------------------------------------------------

@app.route("/api/membership/<var_type>")
def api_membership_distribution(var_type):
    """Generates coordinate sets for clinical distribution curves."""
    valid_parameters = {"bp", "chol", "hr", "output", "age", "smoking", "glucose"}
    if var_type not in valid_parameters:
        return jsonify({"error": f"Invalid parameter: {var_type}"}), 404
        
    modifier = request.args.get("hedge", "none")
    return jsonify(generate_profile_coordinates(var_type, modifier))

@app.route("/api/surface3d")
def api_risk_surface():
    """Generates a 3D grid representing the interaction of clinical factors."""
    hr_baseline = parse_float(request.args.get("hr"), 75.0)
    modifier    = request.args.get("hedge", "none")
    
    surface_data = generate_risk_surface(fixed_hr=hr_baseline, modifier=modifier)
    return jsonify(surface_data)

# ---------------------------------------------------------
# CASE STUDIES & SENSITIVITY ANALYSIS
# ---------------------------------------------------------

@app.route("/api/presets")
def api_case_studies():
    """Returns validated clinical case studies with full diagnostic reports."""
    modifier = request.args.get("hedge", "none")
    study_results = []
    
    for case in CLINICAL_CASE_STUDIES:
        report = run_diagnostic_pipeline(
            case["bp"], case["chol"], case["hr"], modifier,
            case.get("age"), case.get("smoking"), case.get("glucose")
        )
        study_results.append({"case_profile": case, "diagnostic_report": report})
        
    return jsonify(study_results)

@app.route("/api/sensitivity", methods=["GET", "POST"])
def api_sensitivity_profile():
    """Analyzes the marginal influence of variables on the risk score."""
    modifier = "none"
    baseline = CLINICAL_BASELINE.copy()

    if request.method == "POST":
        payload = request.get_json(force=True) or {}
        modifier = str(payload.get("hedge", "none"))
        for key in baseline:
            if payload.get(key) is not None:
                baseline[key] = parse_float(payload.get(key), baseline[key])

    analysis = analyze_factor_impact(baseline, modifier)
    
    # Format response for frontend compatibility
    formatted_analysis = {
        "analysis_grid": analysis.get("analysis_grid", {}),
        "primary_driver": analysis.get("primary_driver", "bp"),
        "impact_ranking": analysis.get("impact_ranking", []),
        "baseline_profile": analysis.get("baseline_profile", baseline),
        "factors": analysis.get("analysis_grid", {})
    }
    
    return jsonify(formatted_analysis)

# ---------------------------------------------------------
# LOGIC OPTIMIZATION & CALIBRATION (Neuro-Fuzzy Module)
# ---------------------------------------------------------

@app.route("/api/logic-calibrate", methods=["POST"])
def api_calibrate_logic():
    """Triggers the parametric optimization sequence for the inference engine."""
    sample_size = int(parse_float(request.args.get("n", 400), 400))
    sample_size = max(100, min(sample_size, 1000))
    
    performance_metrics = nf.calibrate_logic(sample_size)
    return jsonify(performance_metrics)

@app.route("/api/logic-estimate", methods=["POST"])
def api_rapid_estimate():
    """Provides a high-speed risk estimate using calibrated logic parameters."""
    optimizer = nf.get_optimizer()
    if not optimizer.is_initialized:
        return jsonify({"error": "Optimization Module not calibrated. Run calibration sequence."}), 400
        
    payload = request.get_json(force=True) or {}
    estimate = optimizer.estimate_risk(
        bp=parse_float(payload.get("bp"), 130),
        chol=parse_float(payload.get("chol"), 190),
        hr=parse_float(payload.get("hr"), 75),
        age=parse_float(payload.get("age"), 45),
        smoking=parse_float(payload.get("smoking"), 0.5),
        glucose=parse_float(payload.get("glucose"), 110)
    )
    
    return jsonify({
        "estimated_score": estimate, 
        "classification": categorize_risk_score(estimate)
    })

# ---------------------------------------------------------
# SYSTEM CONFIGURATION
# ---------------------------------------------------------

@app.route("/api/knowledge-base")
def api_knowledge_base():
    """Exports the formal rule-set of the expert system."""
    from fuzzy_engine import PRIMARY_RULESET, EXPANDED_RISK_LOGIC
    return jsonify({
        "primary_clinical_rules": PRIMARY_RULESET, 
        "expanded_risk_logic": EXPANDED_RISK_LOGIC
    })

@app.route("/api/hedge-comparison")
def api_hedge_comparison():
    """Returns comparison of different hedges across case studies."""
    hedges = [{"id": h["id"], "label": h["label"]} for h in UI_MODIFIERS[:5]]
    results = []
    
    for case in CLINICAL_CASE_STUDIES:
        case_results = {}
        for hedge in hedges:
            report = run_diagnostic_pipeline(
                case["bp"], case["chol"], case["hr"], hedge["id"],
                case.get("age"), case.get("smoking"), case.get("glucose")
            )
            case_results[hedge["id"]] = {
                "cog": report["primary_assessment"]["score"],
                "sugeno": report["secondary_assessment"]["score"]
            }
        results.append({
            "patient": {
                "name": case.get("case_id", f"Case {len(results)+1}"),
                "bp": case["bp"],
                "chol": case["chol"],
                "hr": case["hr"],
                "age": case.get("age", 45),
                "smoking": case.get("smoking", 0.5),
                "glucose": case.get("glucose", 110)
            },
            "results": case_results
        })
    
    return jsonify({
        "hedges": hedges,
        "table": results
    })

@app.route("/api/health")
def api_health():
    """Health check endpoint for monitoring."""
    return jsonify({
        "status": "healthy",
        "version": "2.0.0",
        "modules": {
            "fuzzy_engine": "active",
            "sensitivity": "active",
            "neuro_fuzzy": "active"
        }
    })

# ---------------------------------------------------------
# ERROR HANDLERS
# ---------------------------------------------------------

@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors gracefully."""
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors gracefully."""
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    """Handle all other exceptions."""
    return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# APPLICATION ENTRY POINT
# ---------------------------------------------------------

# For Vercel serverless deployment
application = app

if __name__ == "__main__":
    # Local development server settings
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
