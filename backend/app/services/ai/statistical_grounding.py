"""Safety boundary for AI-assisted wording of deterministic statistical results."""
import math
import re
from typing import Any

NUMBER_PATTERN=re.compile(r"(?<![\w])[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")

def _numbers(value: Any) -> list[float]:
    if isinstance(value,bool) or value is None: return []
    if isinstance(value,(int,float)):
        return [float(value)] if math.isfinite(float(value)) else []
    if isinstance(value,dict): return [number for item in value.values() for number in _numbers(item)]
    if isinstance(value,list): return [number for item in value for number in _numbers(item)]
    return []

def build_statistical_interpretation_contract(result: dict[str,Any]) -> dict[str,Any]:
    """Only a structured result enters AI context; raw participant rows are forbidden."""
    if not isinstance(result,dict) or not result.get("analysis"): raise ValueError("A structured statistical result is required")
    return {"structured_result":result,"raw_dataset_included":False,"llm_may_compute":False,"requires_academic_review":True,
            "instruction":"Explain only supplied metrics. Do not derive, estimate, or invent numbers; association does not establish causation."}

def validate_statistical_interpretation(text: str, result: dict[str,Any]) -> str:
    allowed=_numbers(result)
    for token in NUMBER_PATTERN.findall(text):
        number=float(token)
        if not any(math.isclose(number,known,rel_tol=1e-9,abs_tol=1e-12) for known in allowed):
            raise ValueError(f"Unsupported numeric claim: {token}")
    if result.get("analysis") in {"PEARSON","SPEARMAN"} and re.search(r"\b(causes?|caused|causal)\b|\bيسبب\b|\bسببية\b",text,re.IGNORECASE):
        raise ValueError("Causal language is not supported by a correlation result")
    return text
