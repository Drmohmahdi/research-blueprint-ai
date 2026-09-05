import pytest
from app.services.prediction_service import (
    run_literature_forecast,
    run_pilot_forecast,
    run_dynamic_forecast,
    train_and_predict_historical,
    calculate_prediction_quality_score
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def test_literature_forecast_bounds():
    """
    Verifies literature-based forecast effect sizes are within expected boundaries,
    and power outputs map between 0.05 and 0.99.
    """
    studies = [
        {"effectSize": 0.50, "sampleSize": 50, "studyQuality": 4, "similarity": 90},
        {"effectSize": 0.30, "sampleSize": 40, "studyQuality": 3, "similarity": 75}
    ]
    res = run_literature_forecast(studies, target_sample_size=60)
    
    assert 0.30 <= res["point_estimate"] <= 0.50
    assert 0.05 <= res["power"] <= 0.99
    assert res["confidence_score"] > 50
    assert "Literature synthesis" in res["data_provenance"]

def test_pilot_bayesian_updates():
    """
    Verifies normal-normal Bayesian update equations dynamically shift
    the posterior treatment mean towards the pilot dataset average.
    """
    prior_mean = 14.0
    prior_variance = 2.0
    
    # Pilot group scores showing a higher actual average (~16) compared to control (~12)
    treatment_scores = [15.0, 16.0, 17.0, 16.0, 16.0]
    control_scores = [12.0, 11.0, 13.0, 12.0, 12.0]
    
    res = run_pilot_forecast(prior_mean, prior_variance, treatment_scores, control_scores)
    
    # Check that posterior mean treatment is computed and updated towards pilot mean (16.0)
    assert 13.0 <= res["post_mean_treatment"] <= 17.0
    assert 10.0 <= res["post_mean_control"] <= 14.0
    assert res["prob_supported"] > 0.5
    assert len(res["pi_95"]) == 2

def test_dynamic_fidelity_attrition_warnings():
    """
    Verifies early dynamic warnings when cohort drops out or fidelity indexes are low.
    """
    # High dropout rate (2 of 3 did not complete)
    cohort_bad = [
        {"attendanceRate": 0.85, "fidelity": 0.90, "completed": True},
        {"attendanceRate": 0.60, "fidelity": 0.50, "completed": False},
        {"attendanceRate": 0.55, "fidelity": 0.40, "completed": False}
    ]
    res_bad = run_dynamic_forecast(cohort_bad, target_sample_size=60)
    assert res_bad["early_warning"] is True
    assert "تسرب" in res_bad["warning_message"] or "التزام" in res_bad["warning_message"]

    # Perfect cohort compliance
    cohort_good = [
        {"attendanceRate": 0.95, "fidelity": 0.98, "completed": True},
        {"attendanceRate": 0.90, "fidelity": 0.95, "completed": True}
    ]
    res_good = run_dynamic_forecast(cohort_good, target_sample_size=60)
    assert res_good["early_warning"] is False
    assert res_good["attrition_rate"] == 0.0

def test_prevent_training_on_synthetic_data():
    """
    Ensures that a ValueError is raised if any row in the training dataset
    is flagged as synthetic (data leakage protection).
    """
    # Create fake session connection
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    # Training dataset contains a simulated synthetic entry
    training_data_leakage = [
        {"sampleSize": 50, "expectedPower": 0.8, "expectedEffectSize": 0.4, "expectedAttritionRate": 0.1, "observedEffectSize": 0.38, "name": "study1", "isSynthetic": True},
        {"sampleSize": 80, "expectedPower": 0.85, "expectedEffectSize": 0.5, "expectedAttritionRate": 0.12, "observedEffectSize": 0.55, "name": "study2", "isSynthetic": False}
    ]
    
    features = {"sampleSize": 60, "expectedPower": 0.8, "expectedEffectSize": 0.5, "expectedAttritionRate": 0.15}
    
    with pytest.raises(ValueError, match="لا يسمح بتدريب نماذج التنبؤ الحقيقية على بيانات محاكاة أو بيانات اصطناعية"):
        train_and_predict_historical(db, "proj-1", "Linear Regression", training_data_leakage, features)
        
    db.close()

def test_prediction_quality_score_calculation():
    """
    Verifies prediction quality rating equations.
    """
    score_lit = calculate_prediction_quality_score("LITERATURE_BASED_FORECAST", data_points=5, avg_similarity=80)
    assert 50 <= score_lit <= 100

    score_pilot = calculate_prediction_quality_score("PILOT_UPDATED_FORECAST", data_points=10, avg_similarity=0)
    assert 60 <= score_pilot <= 95
