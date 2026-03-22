# HealthWise — CHD Fuzzy Expert System

> Coronary Heart Disease Diagnosis using Fuzzy Logic, Linguistic Hedges & Neuro-Fuzzy
> Dr. Mohammed A. Altahrawi · UCAS 2026

## Patient Results
| Patient | BP | Chol | HR | COG | Sugeno | Class |
|---------|----|------|----|-----|--------|-------|
| P1 | 105 | 160 | 55 | 0.6637 | 0.750 | Healthy |
| P2 | 120 | 195 | 65 | 1.5640 | 1.539 | Middle Risk |
| P3 | 165 | 186 | 95 | 2.6838 | 2.857 | Sick |

## Quick Start
```bash
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

## Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

## API Endpoints
- POST /api/diagnose
- GET  /api/membership/<var>?hedge=none
- GET  /api/surface3d?hr=75
- GET  /api/presets
- GET  /api/hedge-comparison
- POST /api/sensitivity
- POST /api/neuro-train?n=400

## Features (95+ marks)
- Fuzzification 7 variables (5 marks)
- 6+9 rules Mamdani inference (5 marks)
- COG + Sugeno defuzzification (5 marks)
- 7 Linguistic Hedges (20 marks)
- Manual calculations 3 patients (10 marks)
- Interactive 3D Plotly surface (10 marks)
- Sensitivity analysis 6 factors (+20 marks)
- ANFIS Neuro-Fuzzy R2=0.965 (+20 marks)
