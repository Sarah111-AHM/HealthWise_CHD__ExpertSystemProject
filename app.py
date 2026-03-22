"""
app.py — HealthWise CHD Expert System
Flask Backend · All API endpoints + HTML serving
Dr. Mohammed A. Altahrawi · UCAS 2026
"""

from flask import Flask, render_template, request, jsonify, abort
from fuzzy_engine import (
    diagnose, mf_curves, surface3d_data,
    PRESET_PATIENTS, HEDGE_META, CORE_RULES, EXT_RULES,
    classify, defuzz_cog, defuzz_sugeno, run_inference,
    age_mf, smoking_mf, diabetes_mf,
)
from sensitivity import run_sensitivity, BASE_PATIENT, FACTOR_LABELS
import neuro_fuzzy as nf

app = Flask(__name__)


# ─────────────────────────────────────────────────────────
# Helper: parse float with default
# ─────────────────────────────────────────────────────────

def _f(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────────────────
# HTML SERVING
# ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template(
        "index.html",
        patients=PRESET_PATIENTS,
        hedges=HEDGE_META,
    )


# ─────────────────────────────────────────────────────────
# API: DIAGNOSE
# ─────────────────────────────────────────────────────────

@app.route("/api/diagnose", methods=["POST"])
def api_diagnose():
    """
    POST body (JSON):
      bp, chol, hr — required
      age, smoking, diabetes, hedge — optional
    Returns full diagnosis result.
    """
    data = request.get_json(force=True) or {}

    bp      = _f(data.get("bp"),       130)
    chol    = _f(data.get("chol"),     190)
    hr      = _f(data.get("hr"),        75)
    hedge   = str(data.get("hedge", "none"))
    age     = _f(data.get("age"),       None) if data.get("age") is not None else None
    smoking = _f(data.get("smoking"),   None) if data.get("smoking") is not None else None
    diabetes= _f(data.get("diabetes"),  None) if data.get("diabetes") is not None else None

    result = diagnose(bp, chol, hr, hedge, age, smoking, diabetes)

    # Also add neuro-fuzzy prediction if model is trained
    nfm = nf.get_model()
    if nfm.is_trained:
        try:
            anf_val = nfm.predict(bp, chol, hr, age, smoking, diabetes)
            result["anfis"] = {"value": anf_val, "cls": classify(anf_val)}
        except Exception:
            pass

    return jsonify(result)


# ─────────────────────────────────────────────────────────
# API: MEMBERSHIP FUNCTIONS
# ─────────────────────────────────────────────────────────

@app.route("/api/membership/<var_type>")
def api_membership(var_type: str):
    """
    GET /api/membership/<var_type>?hedge=none
    var_type: bp | chol | hr | output | age | smoking | diabetes
    """
    valid = {"bp", "chol", "hr", "output", "age", "smoking", "diabetes"}
    if var_type not in valid:
        abort(404, description=f"Unknown var_type '{var_type}'")
    hedge = request.args.get("hedge", "none")
    return jsonify(mf_curves(var_type, hedge))


# ─────────────────────────────────────────────────────────
# API: 3D SURFACE
# ─────────────────────────────────────────────────────────

@app.route("/api/surface3d")
def api_surface3d():
    """
    GET /api/surface3d?hr=75&hedge=none
    Returns 2D grid: bp × chol → COG
    """
    hr    = _f(request.args.get("hr", 75), 75)
    hedge = request.args.get("hedge", "none")
    data  = surface3d_data(hr, hedge)
    return jsonify(data)


# ─────────────────────────────────────────────────────────
# API: PRESET PATIENTS
# ─────────────────────────────────────────────────────────

@app.route("/api/presets")
def api_presets():
    """GET /api/presets — returns the 3 preset patients with full diagnosis."""
    hedge = request.args.get("hedge", "none")
    results = []
    for p in PRESET_PATIENTS:
        r = diagnose(p["bp"], p["chol"], p["hr"], hedge,
                     p["age"], p["smoking"], p["diabetes"])
        results.append({"patient": p, "diagnosis": r})
    return jsonify(results)


# ─────────────────────────────────────────────────────────
# API: HEDGE COMPARISON TABLE
# ─────────────────────────────────────────────────────────

@app.route("/api/hedge-comparison")
def api_hedge_comparison():
    """
    GET /api/hedge-comparison
    Returns for each preset patient + each hedge: COG, Sugeno.
    """
    hedges = [h["value"] for h in HEDGE_META]
    table  = []
    for p in PRESET_PATIENTS:
        row = {"patient": p, "results": {}}
        for h in hedges:
            r = diagnose(p["bp"], p["chol"], p["hr"], h,
                         p["age"], p["smoking"], p["diabetes"])
            row["results"][h] = {
                "cog":    r["cog"]["value"],
                "sugeno": r["sugeno"]["value"],
                "cog_cls":    r["cog"]["cls"],
                "sugeno_cls": r["sugeno"]["cls"],
            }
        table.append(row)
    return jsonify({"hedges": HEDGE_META, "table": table})


# ─────────────────────────────────────────────────────────
# API: SENSITIVITY ANALYSIS
# ─────────────────────────────────────────────────────────

@app.route("/api/sensitivity", methods=["GET", "POST"])
def api_sensitivity():
    """
    GET/POST /api/sensitivity
    Optional POST body: {hedge: "none", bp: 130, ...} to override base.
    """
    hedge = "none"
    base  = BASE_PATIENT.copy()

    if request.method == "POST":
        data  = request.get_json(force=True) or {}
        hedge = str(data.get("hedge", "none"))
        for k in base:
            if data.get(k) is not None:
                base[k] = _f(data.get(k), base[k])

    result = run_sensitivity(base, hedge)

    # Make JSON-serialisable
    serialised = {
        "most_influential": result["most_influential"],
        "ranking": result["ranking"],
        "base_patient": result["base_patient"],
        "factors": {
            k: {
                "x":       v["x"],
                "y_cog":   v["y_cog"],
                "y_sugeno":v["y_sugeno"],
                "label":   v["label"],
                "range_cog": v["range_cog"],
            }
            for k, v in result["factors"].items()
        },
    }
    return jsonify(serialised)


# ─────────────────────────────────────────────────────────
# API: NEURO-FUZZY TRAIN + PREDICT
# ─────────────────────────────────────────────────────────

@app.route("/api/neuro-train", methods=["POST"])
def api_neuro_train():
    """POST /api/neuro-train?n=400  — train the ANFIS model."""
    n = int(_f(request.args.get("n", 400), 400))
    n = max(100, min(n, 1000))
    metrics = nf.train_model(n)
    return jsonify(metrics)


@app.route("/api/neuro-predict", methods=["POST"])
def api_neuro_predict():
    """POST /api/neuro-predict — predict with trained ANFIS model."""
    model = nf.get_model()
    if not model.is_trained:
        return jsonify({"error": "Model not trained. POST /api/neuro-train first."}), 400
    data = request.get_json(force=True) or {}
    bp   = _f(data.get("bp"),   130)
    chol = _f(data.get("chol"), 190)
    hr   = _f(data.get("hr"),    75)
    age  = _f(data.get("age"),   45)
    sk   = _f(data.get("smoking"),  0.5)
    db   = _f(data.get("diabetes"), 110)
    val  = model.predict(bp, chol, hr, age, sk, db)
    return jsonify({"anfis": val, "cls": classify(val)})


# ─────────────────────────────────────────────────────────
# API: RULES
# ─────────────────────────────────────────────────────────

@app.route("/api/rules")
def api_rules():
    return jsonify({"core": CORE_RULES, "extended": EXT_RULES})


# ─────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)
