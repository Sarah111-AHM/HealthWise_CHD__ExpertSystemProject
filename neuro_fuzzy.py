"""
neuro_fuzzy.py — Neuro-Fuzzy (ANFIS-style) Comparison
HealthWise CHD Expert System

Implements a simplified ANFIS using an MLPRegressor trained on
stratified synthetic data from the fuzzy rule engine.
Uses balanced sampling across Healthy / Middle / Sick zones.
"""

import numpy as np
import random
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

from fuzzy_engine import run_inference, defuzz_cog, PRESET_PATIENTS, diagnose, classify


# ═══════════════════════════════════════════════════════════
# BALANCED SYNTHETIC DATA GENERATION
# ═══════════════════════════════════════════════════════════

def generate_synthetic_data(n: int = 500, seed: int = 42) -> tuple:
    """
    Generates balanced synthetic CHD data using the fuzzy oracle.
    Stratified: equal samples in Healthy / Middle / Sick zones.
    n = total samples (split ~equally between 3 zones)
    """
    rng = random.Random(seed)
    np.random.seed(seed)

    n_per_class = n // 3
    X_all, y_all = [], []

    # Define zone-specific input ranges that tend to produce each class
    zone_configs = [
        # Healthy: low BP, low chol, slow HR
        {"bp": (90, 130), "chol": (90, 185), "hr": (38, 85),  "target": "healthy"},
        # Middle: medium values
        {"bp": (115, 175), "chol": (160, 250), "hr": (60, 110), "target": "middle"},
        # Sick: high BP, high chol, fast HR
        {"bp": (155, 210), "chol": (175, 295), "hr": (85, 210), "target": "sick"},
    ]
    thresholds = {"healthy": (0.0, 1.5), "middle": (1.5, 2.7), "sick": (2.7, 4.1)}

    for cfg in zone_configs:
        collected = 0
        tries = 0
        lo_c, hi_c = thresholds[cfg["target"]]
        while collected < n_per_class and tries < 20000:
            bp   = rng.uniform(*cfg["bp"])
            chol = rng.uniform(*cfg["chol"])
            hr   = rng.uniform(*cfg["hr"])
            age  = rng.uniform(10, 90)
            sk   = rng.uniform(0, 3.5)
            db   = rng.uniform(60, 340)
            fired, *_ = run_inference(bp, chol, hr, "none", age, sk, db)
            cog = defuzz_cog(fired)
            if lo_c <= cog < hi_c:
                X_all.append([bp, chol, hr, age, sk, db])
                y_all.append(cog)
                collected += 1
            tries += 1

    # Add uniform random samples for generalization
    for _ in range(n - len(X_all)):
        bp   = rng.uniform(90,  210)
        chol = rng.uniform(90,  295)
        hr   = rng.uniform(38,  210)
        age  = rng.uniform(10,  90)
        sk   = rng.uniform(0,   3.8)
        db   = rng.uniform(60,  340)
        fired, *_ = run_inference(bp, chol, hr, "none", age, sk, db)
        X_all.append([bp, chol, hr, age, sk, db])
        y_all.append(defuzz_cog(fired))

    return np.array(X_all), np.array(y_all)


# ═══════════════════════════════════════════════════════════
# NEURO-FUZZY MODEL (ANFIS-style MLP)
# ═══════════════════════════════════════════════════════════

class NeuroFuzzyModel:
    """
    ANFIS-inspired MLP:
      Input  (6 features: bp, chol, hr, age, smoking, diabetes)
      Hidden layers: (128, 64, 32) with tanh activation
      Output (1): CHD level ∈ [0, 4]

    Training: Adam optimiser, early stopping, MinMaxScaler.
    """

    def __init__(self):
        self.scaler = MinMaxScaler()
        self.model  = MLPRegressor(
            hidden_layer_sizes=(128, 64, 32),
            activation="tanh",
            solver="adam",
            max_iter=1500,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=40,
            learning_rate_init=0.002,
            batch_size=32,
            verbose=False,
        )
        self.train_loss_ = []
        self.is_trained   = False
        self.metrics_     = {}

    def train(self, n_samples: int = 500) -> dict:
        X, y = generate_synthetic_data(n_samples)
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

        X_tr_sc = self.scaler.fit_transform(X_tr)
        X_te_sc = self.scaler.transform(X_te)

        self.model.fit(X_tr_sc, y_tr)

        self.train_loss_ = [round(v, 6) for v in (self.model.loss_curve_ or [])]

        y_pred = self.model.predict(X_te_sc)
        mse    = round(float(mean_squared_error(y_te, y_pred)), 6)
        r2     = round(float(r2_score(y_te, y_pred)), 4)
        mae    = round(float(np.mean(np.abs(y_te - y_pred))), 4)

        # Per-patient comparison with the fuzzy system
        comparison = []
        for p in PRESET_PATIENTS:
            xp    = np.array([[p["bp"], p["chol"], p["hr"], p["age"], p["smoking"], p["diabetes"]]])
            xp_sc = self.scaler.transform(xp)
            anf_val = round(float(np.clip(self.model.predict(xp_sc)[0], 0, 4)), 4)
            fuzz    = diagnose(p["bp"], p["chol"], p["hr"])
            comparison.append({
                "patient":   p["id"],
                "name":      p["name"],
                "fuzzy_cog": fuzz["cog"]["value"],
                "anfis":     anf_val,
                "diff":      round(abs(fuzz["cog"]["value"] - anf_val), 4),
                "fuzzy_cls": fuzz["cog"]["cls"]["label"],
                "anfis_cls": classify(anf_val)["label"],
            })

        self.metrics_ = {
            "mse": mse, "r2": r2, "mae": mae,
            "n_train": len(X_tr), "n_test": len(X_te),
            "epochs":  len(self.train_loss_),
            "train_loss": self.train_loss_,
            "comparison": comparison,
        }
        self.is_trained = True
        return self.metrics_

    def predict(self, bp, chol, hr, age=None, smoking=None, diabetes=None) -> float:
        if not self.is_trained:
            raise RuntimeError("Model not trained. POST /api/neuro-train first.")
        age      = float(age)      if age      is not None else 45.0
        smoking  = float(smoking)  if smoking  is not None else 0.5
        diabetes = float(diabetes) if diabetes is not None else 110.0
        xp = np.array([[bp, chol, hr, age, smoking, diabetes]])
        xp_sc = self.scaler.transform(xp)
        val = float(np.clip(self.model.predict(xp_sc)[0], 0, 4))
        return round(val, 4)


# Singleton
_model: NeuroFuzzyModel | None = None

def get_model() -> NeuroFuzzyModel:
    global _model
    if _model is None:
        _model = NeuroFuzzyModel()
    return _model

def train_model(n_samples: int = 500) -> dict:
    m = get_model()
    return m.train(n_samples)
