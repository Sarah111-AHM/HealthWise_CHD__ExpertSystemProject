"""
Logic Optimization & Empirical Validation Module.
Assesses the expert system's consistency using a regression-based 
simulation (Parametric Approximation).
"""

import numpy as np
import random
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Unified imports from our core engine
from fuzzy_engine import (
    execute_inference, calculate_final_score, 
    CLINICAL_CASE_STUDIES, run_diagnostic_pipeline, categorize_risk_score
)

# ---------------------------------------------------------
# SYNTHETIC DATA GENERATION FOR SYSTEM STRESS-TESTING
# ---------------------------------------------------------

def generate_validation_dataset(sample_size=500, seed=42):
    """
    Generates a balanced dataset across clinical risk zones 
    to validate the consistency of the inference engine.
    """
    rng = random.Random(seed)
    np.random.seed(seed)

    samples_per_zone = sample_size // 3
    features, targets = [], []

    # Risk zones for targeted sampling (Healthy, Intermediate, Critical)
    risk_profiles = [
        {"bp": (90, 130),  "chol": (90, 185),  "hr": (38, 85),  "range": (0.0, 1.5)},
        {"bp": (115, 175), "chol": (160, 250), "hr": (60, 110), "range": (1.5, 2.7)},
        {"bp": (155, 210), "chol": (175, 295), "hr": (85, 210), "range": (2.7, 4.1)},
    ]

    for profile in risk_profiles:
        count = 0
        attempts = 0
        min_r, max_r = profile["range"]
        
        while count < samples_per_zone and attempts < 20000:
            bp   = rng.uniform(*profile["bp"])
            chol = rng.uniform(*profile["chol"])
            hr   = rng.uniform(*profile["hr"])
            age  = rng.uniform(10, 90)
            smk  = rng.uniform(0, 3.5)
            gluc = rng.uniform(60, 340)
            
            active_rules, _ = execute_inference(bp, chol, hr, "none", age, smk, gluc)
            score = calculate_final_score(active_rules)
            
            if min_r <= score < max_r:
                features.append([bp, chol, hr, age, smk, gluc])
                targets.append(score)
                count += 1
            attempts += 1

    # Fill remaining with general distribution
    for _ in range(sample_size - len(features)):
        bp, chol, hr = rng.uniform(90, 210), rng.uniform(90, 295), rng.uniform(38, 210)
        age, smk, gluc = rng.uniform(10, 90), rng.uniform(0, 3.8), rng.uniform(60, 340)
        
        active_rules, _ = execute_inference(bp, chol, hr, "none", age, smk, gluc)
        features.append([bp, chol, hr, age, smk, gluc])
        targets.append(calculate_final_score(active_rules))

    return np.array(features), np.array(targets)


# ---------------------------------------------------------
# LOGIC APPROXIMATION MODEL (Parametric Optimization)
# ---------------------------------------------------------

class LogicOptimizationModule:
    """
    Uses a multi-layer parametric regressor to approximate 
    and validate the fuzzy inference logic.
    """

    def __init__(self):
        self.feature_scaler = MinMaxScaler()
        # The 'Engine' behind the approximation
        self.approximator = MLPRegressor(
            hidden_layer_sizes=(128, 64, 32),
            activation="tanh",
            solver="adam",
            max_iter=1500,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=40,
            learning_rate_init=0.002,
            batch_size=32
        )
        self.error_convergence = []
        self.is_initialized = False
        self.performance_metrics = {}

    def run_calibration(self, n_samples=500):
        """Calibrates the approximator using the core engine's logic."""
        X, y = generate_validation_dataset(n_samples)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        X_train_scaled = self.feature_scaler.fit_transform(X_train)
        X_test_scaled  = self.feature_scaler.transform(X_test)

        self.approximator.fit(X_train_scaled, y_train)
        self.error_convergence = [round(v, 6) for v in (self.approximator.loss_curve_ or [])]

        # Validation Metrics
        predictions = self.approximator.predict(X_test_scaled)
        mse = round(float(mean_squared_error(y_test, predictions)), 6)
        r2  = round(float(r2_score(y_test, predictions)), 4)
        mae = round(float(np.mean(np.abs(y_test - predictions))), 4)

        # Cross-reference with clinical cases
        validation_audit = []
        for case in CLINICAL_CASE_STUDIES:
            x_vec = np.array([[case["bp"], case["chol"], case["hr"], case["age"], case["smoking"], case["glucose"]]])
            x_scaled = self.feature_scaler.transform(x_vec)
            
            approx_val = round(float(np.clip(self.approximator.predict(x_scaled)[0], 0, 4)), 4)
            actual_diag = run_diagnostic_pipeline(case["bp"], case["chol"], case["hr"])
            actual_val = actual_diag["primary_assessment"]["score"]
            
            validation_audit.append({
                "case_id":    case["case_id"],
                "engine_val": actual_val,
                "approx_val": approx_val,
                "variance":   round(abs(actual_val - approx_val), 4),
                "engine_status": actual_diag["primary_assessment"]["classification"]["label"],
                "approx_status": categorize_risk_score(approx_val)["label"]
            })

        self.performance_metrics = {
            "mean_squared_error": mse, "r2_coefficient": r2, "mean_abs_error": mae,
            "training_size": len(X_train), "test_size": len(X_test),
            "convergence_steps": len(self.error_convergence),
            "audit_results": validation_audit
        }
        self.is_initialized = True
        return self.performance_metrics

    def estimate_risk(self, bp, chol, hr, age=45, smoking=0.5, glucose=110):
        """Provides a rapid risk estimate using the calibrated parameters."""
        if not self.is_initialized:
            raise RuntimeError("Module not calibrated. Please run calibration sequence first.")
        
        input_vector = np.array([[float(bp), float(chol), float(hr), float(age), float(smoking), float(glucose)]])
        scaled_vector = self.feature_scaler.transform(input_vector)
        
        estimate = float(np.clip(self.approximator.predict(scaled_vector)[0], 0, 4))
        return round(estimate, 4)


# Logic Singleton for global access
_logic_module = None

def get_optimizer():
    global _logic_module
    if _logic_module is None:
        _logic_module = LogicOptimizationModule()
    return _logic_module

def calibrate_logic(n_samples=500):
    return get_optimizer().run_calibration(n_samples)
