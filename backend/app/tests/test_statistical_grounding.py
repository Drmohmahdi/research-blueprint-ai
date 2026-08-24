import pytest
from app.services.ai.statistical_grounding import build_statistical_interpretation_contract, validate_statistical_interpretation

RESULT={"analysis":"INDEPENDENT_T_TEST","p_value":0.021,"effect_size":{"value":0.63},"confidence_interval":[0.21,1.05]}

def test_ai_contract_contains_structured_result_not_raw_dataset():
    contract=build_statistical_interpretation_contract(RESULT)
    assert contract["structured_result"]==RESULT and contract["raw_dataset_included"] is False and contract["llm_may_compute"] is False

def test_ai_interpretation_preserves_allowed_numeric_result():
    text="p = 0.021, effect size = 0.63, CI [0.21, 1.05]."
    assert validate_statistical_interpretation(text,RESULT)==text

def test_ai_interpretation_cannot_invent_numeric_result():
    with pytest.raises(ValueError,match="Unsupported numeric claim"):
        validate_statistical_interpretation("p = 0.002 and df = 182",RESULT)

def test_ai_correlation_interpretation_cannot_claim_causation():
    with pytest.raises(ValueError,match="Causal language"):
        validate_statistical_interpretation("X causes Y",{"analysis":"PEARSON","statistic":0.5,"p_value":0.02})

def test_ai_cannot_receive_raw_data_for_statistical_computation():
    with pytest.raises(ValueError,match="structured statistical result"):
        build_statistical_interpretation_contract({"rows":[{"participant":"secret","score":3}]})
