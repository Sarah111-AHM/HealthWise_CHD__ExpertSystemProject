# HealthWise — Manual Calculations
**Dr. Mohammed A. Altahrawi · UCAS 2026**


---
## Patient 1: BP=105, Chol=160, HR=55

### Step 1 — Fuzzification

| Variable | Set | Degree |
|----------|-----|--------|
| BP | low | 1.0 |
| BP | medium | 0.0 |
| BP | high | 0.0 |
| Chol | low | 1.0 |
| Chol | high | 0.0 |
| HR | slow | 1.0 |
| HR | moderate | 0.0 |
| HR | fast | 0.0 |

### Step 2 — Rule Firing

| Rule | Conditions | Degrees | Strength | Output |
|------|-----------|---------|----------|--------|
| 1 | BP=low, Chol=low, HR=slow | 1.0·1.0·1.0 | **1.0** | healthy |
| 2 | BP=low, Chol=low, HR=moderate | 1.0·1.0·0.0 | **0.0** | healthy |
| 3 | BP=medium, Chol=low, HR=moderate | 0.0·1.0·0.0 | **0.0** | middle |
| 4 | BP=medium, Chol=high, HR=slow | 0.0·0.0·1.0 | **0.0** | middle |
| 5 | BP=high, Chol=low, HR=moderate | 0.0·1.0·0.0 | **0.0** | sick |
| 6 | BP=high, Chol=high, HR=fast | 0.0·0.0·0.0 | **0.0** | sick |

### Step 3 — Aggregation

- **healthy**: 1.0

- **middle**: 0.0

- **sick**: 0.0

### Step 4 — Defuzzification

- **COG = 0.6637** → Healthy
- **Sugeno = 0.75** → Healthy

### Step 5 — Hedge Analysis

| Hedge | Formula | COG | Sugeno | ΔCOG |
|-------|---------|-----|--------|------|
| none | μ | 0.6637 | 0.75 | +0.0 |
| very | μ² | 0.6637 | 0.75 | +0.0 |
| extremely | μ³ | 0.6637 | 0.75 | +0.0 |
| somewhat | √μ | 0.6637 | 0.75 | +0.0 |
| slightly | μ^1.25 | 0.6637 | 0.75 | +0.0 |

---
## Patient 2: BP=120, Chol=195, HR=65

### Step 1 — Fuzzification

| Variable | Set | Degree |
|----------|-----|--------|
| BP | low | 0.75 |
| BP | medium | 0.2857 |
| BP | high | 0.0 |
| Chol | low | 0.1667 |
| Chol | high | 0.8696 |
| HR | slow | 1.0 |
| HR | moderate | 0.0 |
| HR | fast | 0.0 |

### Step 2 — Rule Firing

| Rule | Conditions | Degrees | Strength | Output |
|------|-----------|---------|----------|--------|
| 1 | BP=low, Chol=low, HR=slow | 0.75·0.1667·1.0 | **0.1667** | healthy |
| 2 | BP=low, Chol=low, HR=moderate | 0.75·0.1667·0.0 | **0.0** | healthy |
| 3 | BP=medium, Chol=low, HR=moderate | 0.2857·0.1667·0.0 | **0.0** | middle |
| 4 | BP=medium, Chol=high, HR=slow | 0.2857·0.8696·1.0 | **0.2857** | middle |
| 5 | BP=high, Chol=low, HR=moderate | 0.0·0.1667·0.0 | **0.0** | sick |
| 6 | BP=high, Chol=high, HR=fast | 0.0·0.8696·0.0 | **0.0** | sick |

### Step 3 — Aggregation

- **healthy**: 0.1667

- **middle**: 0.2857

- **sick**: 0.0

### Step 4 — Defuzzification

- **COG = 1.564** → Middle Risk
- **Sugeno = 1.5394** → Middle Risk

### Step 5 — Hedge Analysis

| Hedge | Formula | COG | Sugeno | ΔCOG |
|-------|---------|-----|--------|------|
| none | μ | 1.564 | 1.5394 | +0.0 |
| very | μ² | 1.739 | 1.6824 | +0.175 |
| extremely | μ³ | 1.8415 | 1.7939 | +0.2775 |
| somewhat | √μ | 1.4208 | 1.4587 | -0.1432 |
| slightly | μ^1.25 | 1.6188 | 1.5779 | +0.0548 |

---
## Patient 3: BP=165, Chol=186, HR=95

### Step 1 — Fuzzification

| Variable | Set | Degree |
|----------|-----|--------|
| BP | low | 0.0 |
| BP | medium | 0.4286 |
| BP | high | 0.7692 |
| Chol | low | 0.4667 |
| Chol | high | 0.4783 |
| HR | slow | 0.0 |
| HR | moderate | 0.4545 |
| HR | fast | 0.5 |

### Step 2 — Rule Firing

| Rule | Conditions | Degrees | Strength | Output |
|------|-----------|---------|----------|--------|
| 1 | BP=low, Chol=low, HR=slow | 0.0·0.4667·0.0 | **0.0** | healthy |
| 2 | BP=low, Chol=low, HR=moderate | 0.0·0.4667·0.4545 | **0.0** | healthy |
| 3 | BP=medium, Chol=low, HR=moderate | 0.4286·0.4667·0.4545 | **0.4286** | middle |
| 4 | BP=medium, Chol=high, HR=slow | 0.4286·0.4783·0.0 | **0.0** | middle |
| 5 | BP=high, Chol=low, HR=moderate | 0.7692·0.4667·0.4545 | **0.4545** | sick |
| 6 | BP=high, Chol=high, HR=fast | 0.7692·0.4783·0.5 | **0.4783** | sick |

### Step 3 — Aggregation

- **healthy**: 0.0

- **middle**: 0.4286

- **sick**: 0.4783

### Step 4 — Defuzzification

- **COG = 2.6838** → Middle Risk
- **Sugeno = 2.8565** → Sick

### Step 5 — Hedge Analysis

| Hedge | Formula | COG | Sugeno | ΔCOG |
|-------|---------|-----|--------|------|
| none | μ | 2.6838 | 2.8565 | +0.0 |
| very | μ² | 2.669 | 2.8791 | -0.0148 |
| extremely | μ³ | 2.6832 | 2.9012 | -0.0006 |
| somewhat | √μ | 2.7182 | 2.845 | +0.0344 |
| slightly | μ^1.25 | 2.6756 | 2.8622 | -0.0082 |