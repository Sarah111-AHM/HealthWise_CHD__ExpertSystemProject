"""
HealthWise CHD Expert System — Flask API
Deploy on Vercel via @vercel/python
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify, send_from_directory
from fuzzy_engine import (
    diagnose, get_membership_curve, generate_3d_surface,
    PRESET_PATIENTS, HEDGE_OPS, bp_membership, chol_membership, hr_membership,
    apply_hedge, inference_engine, defuzzify_cog, defuzzify_sugeno, classify_chd,
)

# ── Flask app ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates'),
)


# ── Serve frontend ─────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(app.template_folder, 'index.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(app.static_folder, filename)


# ── API: Diagnose ──────────────────────────────────────────────────────────

@app.route('/api/diagnose', methods=['POST'])
def api_diagnose():
    data  = request.get_json()
    bp    = float(data.get('bp',   130))
    chol  = float(data.get('chol', 180))
    hr    = float(data.get('hr',    75))
    hedge = data.get('hedge', 'none')

    result = diagnose(bp, chol, hr, hedge)
    return jsonify(result)


# ── API: Membership curves ─────────────────────────────────────────────────

@app.route('/api/membership/<var_type>')
def api_membership(var_type):
    hedge  = request.args.get('hedge', 'none')
    points = int(request.args.get('points', 120))
    data   = get_membership_curve(var_type, points)

    # Apply hedge if requested
    if hedge != 'none':
        non_x_keys = [k for k in data[0] if k != 'x']
        for row in data:
            for k in non_x_keys:
                row[k] = apply_hedge(row[k], hedge)

    return jsonify(data)


# ── API: 3D Surface ────────────────────────────────────────────────────────

@app.route('/api/surface3d')
def api_surface3d():
    hr = float(request.args.get('hr', 75))
    return jsonify(generate_3d_surface(fixed_hr=hr))


# ── API: Preset patients ───────────────────────────────────────────────────

@app.route('/api/presets')
def api_presets():
    hedge   = request.args.get('hedge', 'none')
    results = []
    for p in PRESET_PATIENTS:
        r = diagnose(p['bp'], p['chol'], p['hr'], hedge)
        results.append({'patient': p, 'result': r})
    return jsonify(results)


# ── API: Hedge comparison ──────────────────────────────────────────────────

@app.route('/api/hedge-comparison')
def api_hedge_comparison():
    hedges = ['none', 'very', 'extremely', 'somewhat', 'more_or_less', 'slightly']
    data   = []
    for p in PRESET_PATIENTS:
        row = {'patient': p, 'hedges': {}}
        for h in hedges:
            r = diagnose(p['bp'], p['chol'], p['hr'], h)
            row['hedges'][h] = {
                'cog':    r['cog']['value'],
                'sugeno': r['sugeno']['value'],
                'cog_label':    r['cog']['classification']['label'],
                'sugeno_label': r['sugeno']['classification']['label'],
            }
        data.append(row)
    return jsonify(data)


# ── Entrypoint ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(debug=True, port=5000)
