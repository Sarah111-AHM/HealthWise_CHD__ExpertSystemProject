# HealthWise — CHD Fuzzy Expert System (Python/Flask)

> **UCAS 2026 | Expert Systems | Dr. Mohammed A. Altahrawi**

Full-stack Python + Flask web application implementing a Fuzzy Logic CHD diagnostic expert system.

---

## Deploy to Vercel

### 1-Click
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/healthwise-chd-python)

### Manual
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## Run Locally

```bash
pip install -r requirements.txt
python api/index.py
# Open http://localhost:5000
```

---

## System Architecture

```
healthwise-py/
├── api/
│   ├── index.py          
│   └── fuzzy_engine.py   
├── static/
│   ├── css/main.css    
│   └── js/app.js        
├── templates/
│   └── index.html       
├── requirements.txt    
└── vercel.json           
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/diagnose` | Run full diagnosis (COG + Sugeno) |
| GET | `/api/membership/<type>` | Get membership curve data |
| GET | `/api/surface3d?hr=75` | Get 3D surface data |
| GET | `/api/presets?hedge=none` | Get all 3 preset patients |
| GET | `/api/hedge-comparison` | Hedge sensitivity table |

### POST /api/diagnose
```json
// Request
{ "bp": 105, "chol": 160, "hr": 55, "hedge": "none" }

// Response
{
  "inputs": {"bp": 105, "chol": 160, "hr": 55},
  "memberships": {"bp": {...}, "chol": {...}, "hr": {...}},
  "rule_strengths": [...],
  "cog":    {"value": 0.75, "classification": {"label": "Healthy", "color": "#00ff9d", ...}},
  "sugeno": {"value": 0.75, "classification": {...}},
  "hedge": "none"
}
```

---

## Fuzzy System Design

### Membership Functions
| Variable | Set | Function | Parameters |
|----------|-----|----------|------------|
| BP (mmHg) | Low | Trapezoidal | (80, 100, 120, 135) |
| BP | Medium | Triangular | (115, 145, 175) |
| BP | High | Trapezoidal | (160, 175, 200, 220) |
| Chol (mg/dL) | Low | Trapezoidal | (80, 100, 170, 195) |
| Chol | High | Trapezoidal | (175, 200, 280, 300) |
| HR (bpm) | Slow | Trapezoidal | (30, 50, 70, 85) |
| HR | Moderate | Triangular | (65, 85, 105) |
| HR | Fast | Trapezoidal | (90, 110, 200, 220) |

### Rule Base
| Rule | BP | Cholesterol | HR | CHD |
|------|----|-------------|-----|-----|
| 1 | Low | Low | Slow | Healthy |
| 2 | Low | Low | Moderate | Healthy |
| 3 | Medium | Low | Moderate | Middle |
| 4 | Medium | High | Slow | Middle |
| 5 | High | Low | Moderate | Sick |
| 6 | High | High | Fast | Sick |

### Linguistic Hedges
| Hedge | Operator | Effect |
|-------|----------|--------|
| very / indeed | μ² | Concentrate (sharpen) |
| extremely | μ³ | Strong concentration |
| somewhat / more_or_less | √μ | Dilate (widen) |
| slightly | μ^1.25 | Mild concentration |

---

## Preset Patients 

| Patient | BP | Chol | HR | COG | Sugeno | Classification |
|---------|-----|------|-----|-----|--------|----------------|
| 1 | 105 | 160 | 55 | ~0.75 | ~0.75 | Healthy |
| 2 | 120 | 195 | 65 | ~2.0 | ~2.0 | Middle |
| 3 | 165 | 186 | 95 | ~2.6 | ~2.7 | Middle-Sick |
