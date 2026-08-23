import hashlib
import json
from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone

from .. import models, schemas

ALLOWED_METRICS = {
    "points", "publication_points", "total_points",
    "asset_count", "published_papers", "paper_count", "publications",
    "q1_q2_count", "indexed_publications",
    "sole_first_author_count", "lead_author_count",
    "generic"
}

ALLOWED_OPERATORS = {">=", ">", "<=", "<", "==", "!=", "IN"}


def compute_evidence_points(asset: models.ScholarlyAsset, custom_rules: Dict[str, Any] = None) -> float:
    """
    Computes publication points based on journal rank (quartile) and authorship role.
    Deterministic, explainable calculation.
    """
    metadata = asset.metadata_json or {}
    journal_rank = str(metadata.get("journal_rank") or metadata.get("rank") or "Q3").strip().upper()
    role = str(metadata.get("author_role") or metadata.get("role") or "first").strip().lower()

    # Determine author position from contributors if available
    if asset.contributors:
        for c in asset.contributors:
            if getattr(c, "author_order", None) == 1:
                role = "first"
                break

    # Base points by quartile
    base_points = 10.0
    if journal_rank == "Q1":
        base_points = 20.0
    elif journal_rank == "Q2":
        base_points = 15.0
    elif journal_rank == "Q3":
        base_points = 10.0
    elif journal_rank == "Q4":
        base_points = 5.0

    # Role multiplier
    multiplier = 0.5
    if role in ["sole", "single"]:
        multiplier = 1.0
    elif role in ["first", "lead", "principal"]:
        multiplier = 0.75
    elif role in ["corresponding", "co-author", "coauthor"]:
        multiplier = 0.5

    return round(float(base_points * multiplier), 2)


def generate_evaluation_fingerprint(
    policy_id: str,
    policy_version: int,
    target_rank: str,
    evidence_items: List[models.PromotionAssetSelection]
) -> str:
    """Creates a deterministic, canonical sha256 fingerprint of the inputs used for evaluation."""
    asset_ids = sorted([str(ev.scholarly_asset_id) for ev in evidence_items])
    canonical_payload = json.dumps({
        "policy_id": str(policy_id),
        "policy_version": int(policy_version),
        "target_rank": str(target_rank).upper(),
        "asset_ids": asset_ids
    }, sort_keys=True)
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()[:16]


def evaluate_criterion_rule(
    criterion: models.PromotionCriterion,
    assets: List[models.ScholarlyAsset],
    application: models.PromotionApplication
) -> schemas.CriterionEvaluationResult:
    """
    Evaluates a single promotion criterion using safe declarative operators.
    Strictly forbids eval(), exec(), or dynamic code execution.
    """
    rule = criterion.rule_definition_json or {}
    metric = str(rule.get("metric", "points")).strip().lower()
    operator = str(rule.get("operator", ">=")).strip().upper()
    
    # Safe numerical extraction
    raw_val = rule.get("value", criterion.required_points or criterion.min_asset_count or 0.0)
    try:
        target_value = float(raw_val)
    except (ValueError, TypeError):
        target_value = 0.0

    actual_value = 0.0
    actual_count = len(assets)
    evidence_ids = [a.id for a in assets]
    missing_items = []

    # Security check: Whitelist operator and metric
    if operator not in ALLOWED_OPERATORS or metric not in ALLOWED_METRICS:
        return schemas.CriterionEvaluationResult(
            criterion_id=criterion.id,
            code=criterion.code,
            title_ar=criterion.title_ar,
            title_en=criterion.title_en,
            criterion_type=criterion.criterion_type,
            is_mandatory=criterion.is_mandatory,
            status="NOT_SATISFIED",
            required_value=target_value,
            actual_value=0.0,
            required_count=criterion.min_asset_count,
            actual_count=actual_count,
            points_earned=0.0,
            evidence_asset_ids=evidence_ids,
            explanation_ar="قاعدة المعيار تحتوي على معامل أو مقياس غير مصرح به أمنياً.",
            explanation_en="Criterion definition contains an unauthorized metric or operator.",
            missing_items=["مراجعة صياغة قاعدة المعيار مع الإدارة"]
        )

    if metric in ["points", "publication_points", "total_points"]:
        points_list = [compute_evidence_points(a) for a in assets]
        actual_value = round(sum(points_list), 2)
        points_earned = actual_value

        if actual_value >= target_value:
            status = "SATISFIED"
            exp_ar = f"تم استيفاء شرط النقاط البحثية المطلوبة ({actual_value} من أصل {target_value} نقطة)."
            exp_en = f"Required research points met ({actual_value} out of {target_value} required points)."
        elif actual_value > 0:
            status = "PARTIALLY_SATISFIED"
            deficit = round(target_value - actual_value, 2)
            exp_ar = f"استيفاء جزئي لنقاط النشر؛ تم تحقيق {actual_value} من أصل {target_value} نقطة (المتبقي: {deficit} نقطة)."
            exp_en = f"Partially satisfied; earned {actual_value} out of {target_value} points (Remaining deficit: {deficit} points)."
            missing_items.append(f"بحاجة إلى {deficit} نقطة إضافية من النشر العلمي")
        else:
            status = "MISSING_EVIDENCE" if criterion.is_mandatory else "NOT_SATISFIED"
            exp_ar = f"لم يتم تقديم أبحاث كافية لاحتساب النقاط المطلوبة ({target_value} نقطة)."
            exp_en = f"No research evidence provided to satisfy required points ({target_value} points)."
            missing_items.append(f"تقديم أوراق علمية للحصول على {target_value} نقطة")

    elif metric in ["asset_count", "published_papers", "paper_count", "publications"]:
        actual_value = float(len(assets))
        points_earned = round(sum(compute_evidence_points(a) for a in assets), 2)

        if actual_value >= target_value:
            status = "SATISFIED"
            exp_ar = f"تم استيفاء الحد الأدنى من الأبحاث المنشورة ({int(actual_value)} من أصل {int(target_value)} أبحاث)."
            exp_en = f"Minimum published papers met ({int(actual_value)} out of {int(target_value)} required papers)."
        elif actual_value > 0:
            status = "PARTIALLY_SATISFIED"
            deficit = int(target_value - actual_value)
            exp_ar = f"تم تقديم {int(actual_value)} أبحاث من أصل {int(target_value)} مطلوبة (متبقي: {deficit} أبحاث)."
            exp_en = f"Submitted {int(actual_value)} out of {int(target_value)} required papers (Missing: {deficit} papers)."
            missing_items.append(f"إضافة {deficit} أبحاث منشورة إضافية")
        else:
            status = "MISSING_EVIDENCE" if criterion.is_mandatory else "NOT_SATISFIED"
            exp_ar = f"لم يتم تقديم أي أبحاث منشورة لاستيفاء شرط الحد الأدنى ({int(target_value)} أبحاث)."
            exp_en = f"No published papers submitted for minimum requirement ({int(target_value)} papers)."
            missing_items.append(f"تقديم {int(target_value)} أبحاث منشورة")

    elif metric in ["q1_q2_count", "indexed_publications"]:
        q1_q2_assets = [
            a for a in assets
            if str((a.metadata_json or {}).get("journal_rank") or (a.metadata_json or {}).get("rank") or "").strip().upper() in ["Q1", "Q2"]
        ]
        actual_value = float(len(q1_q2_assets))
        points_earned = round(sum(compute_evidence_points(a) for a in q1_q2_assets), 2)
        evidence_ids = [a.id for a in q1_q2_assets]

        if actual_value >= target_value:
            status = "SATISFIED"
            exp_ar = f"تم استيفاء شرط الأبحاث في مجلات مصنفة Q1/Q2 ({int(actual_value)} من أصل {int(target_value)})."
            exp_en = f"Required Q1/Q2 indexed papers met ({int(actual_value)} out of {int(target_value)})."
        elif actual_value > 0:
            status = "PARTIALLY_SATISFIED"
            deficit = int(target_value - actual_value)
            exp_ar = f"يوجد {int(actual_value)} أبحاث مصنفة Q1/Q2 من أصل {int(target_value)} مطلوبة."
            exp_en = f"Found {int(actual_value)} Q1/Q2 papers out of {int(target_value)} required."
            missing_items.append(f"نشر {deficit} أبحاث في مجلات Q1 أو Q2")
        else:
            status = "MISSING_EVIDENCE" if criterion.is_mandatory else "NOT_SATISFIED"
            exp_ar = f"لا توجد أبحاث منشورة في مجلات Q1/Q2 مسجلة بالملف (المطلوب: {int(target_value)})."
            exp_en = f"No Q1/Q2 indexed papers found in portfolio (Required: {int(target_value)})."
            missing_items.append(f"نشر {int(target_value)} أبحاث في مجلات Q1 أو Q2")

    elif metric in ["sole_first_author_count", "lead_author_count"]:
        lead_assets = [
            a for a in assets
            if str((a.metadata_json or {}).get("author_role") or (a.metadata_json or {}).get("role") or "").strip().lower() in ["sole", "single", "first", "lead", "principal"]
        ]
        actual_value = float(len(lead_assets))
        points_earned = round(sum(compute_evidence_points(a) for a in lead_assets), 2)
        evidence_ids = [a.id for a in lead_assets]

        if actual_value >= target_value:
            status = "SATISFIED"
            exp_ar = f"تم استيفاء شرط النشر كباحث رئيس أو منفرد ({int(actual_value)} من أصل {int(target_value)})."
            exp_en = f"Lead or sole authorship requirement met ({int(actual_value)} out of {int(target_value)})."
        else:
            deficit = int(target_value - actual_value)
            status = "PARTIALLY_SATISFIED" if actual_value > 0 else ("MISSING_EVIDENCE" if criterion.is_mandatory else "NOT_SATISFIED")
            exp_ar = f"المتحقق كباحث رئيس أو منفرد {int(actual_value)} من أصل {int(target_value)} مطلوبة."
            exp_en = f"Lead authorship count is {int(actual_value)} out of {int(target_value)} required."
            missing_items.append(f"إضافة {deficit} أبحاث بدور باحث رئيس أو منفرد")

    else:
        # Generic institutional criterion
        points_earned = criterion.required_points if target_value > 0 else 10.0
        actual_value = target_value
        status = "SATISFIED"
        exp_ar = f"المعيار المؤسسي: {criterion.title_ar} مسجل باللائحة."
        exp_en = f"Institutional criterion: {criterion.title_en} recorded."

    return schemas.CriterionEvaluationResult(
        criterion_id=criterion.id,
        code=criterion.code,
        title_ar=criterion.title_ar,
        title_en=criterion.title_en,
        criterion_type=criterion.criterion_type,
        is_mandatory=criterion.is_mandatory,
        status=status,
        required_value=target_value,
        actual_value=actual_value,
        required_count=criterion.min_asset_count,
        actual_count=actual_count,
        points_earned=points_earned,
        evidence_asset_ids=evidence_ids,
        explanation_ar=exp_ar,
        explanation_en=exp_en,
        missing_items=missing_items
    )


def evaluate_promotion_application(
    application: models.PromotionApplication,
    policy: models.PromotionPolicy,
    criteria: List[models.PromotionCriterion],
    evidence_selections: List[models.PromotionAssetSelection],
    all_assets: List[models.ScholarlyAsset]
) -> schemas.PromotionEvaluationResult:
    """
    Performs full explainable promotion readiness evaluation.
    Returns structured results with human-in-the-loop disclaimers.
    Deterministic, free of external AI dependencies.
    """
    asset_map = {a.id: a for a in all_assets}
    selected_assets = [asset_map[ev.scholarly_asset_id] for ev in evidence_selections if ev.scholarly_asset_id in asset_map]

    criteria_results = []
    total_earned_points = sum(compute_evidence_points(a) for a in selected_assets)
    total_required_points = sum(c.required_points for c in criteria if c.required_points > 0)
    if total_required_points == 0:
        total_required_points = float((policy.rules_json or {}).get("min_total_points", 40.0))

    recommendations_ar = []
    recommendations_en = []
    mandatory_satisfied = True

    for criterion in criteria:
        res = evaluate_criterion_rule(criterion, selected_assets, application)
        criteria_results.append(res)

        if criterion.is_mandatory and res.status not in ["SATISFIED"]:
            mandatory_satisfied = False

        if res.missing_items:
            recommendations_ar.extend(res.missing_items)
            recommendations_en.append(f"{criterion.title_en}: Missing requirements")

    # Readiness Algorithm:
    # 1. Base readiness is percentage of mandatory criteria satisfied (weight 70%)
    # 2. Points fulfillment percentage (weight 30%)
    mandatory_criteria = [c for c in criteria if c.is_mandatory]
    satisfied_mandatory = [r for r in criteria_results if r.is_mandatory and r.status == "SATISFIED"]

    if mandatory_criteria:
        mandatory_ratio = len(satisfied_mandatory) / len(mandatory_criteria)
    else:
        mandatory_ratio = 1.0

    points_ratio = min(1.0, total_earned_points / total_required_points) if total_required_points > 0 else 1.0

    overall_readiness = int(round((mandatory_ratio * 70.0) + (points_ratio * 30.0)))
    overall_readiness = max(0, min(100, overall_readiness))

    is_fully_ready = (overall_readiness >= 100) and mandatory_satisfied

    fingerprint = generate_evaluation_fingerprint(
        policy.id,
        policy.version,
        application.target_rank,
        evidence_selections
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    return schemas.PromotionEvaluationResult(
        application_id=application.id,
        policy_id=policy.id,
        policy_name_ar=policy.name_ar,
        policy_name_en=policy.name_en,
        policy_version=policy.version,
        target_rank=application.target_rank,
        readiness_percentage=overall_readiness,
        is_fully_ready=is_fully_ready,
        total_calculated_points=round(total_earned_points, 2),
        total_required_points=round(total_required_points, 2),
        total_evidence_count=len(selected_assets),
        mandatory_criteria_satisfied=mandatory_satisfied,
        criteria_results=criteria_results,
        recommendations_ar=list(dict.fromkeys(recommendations_ar)),
        recommendations_en=list(dict.fromkeys(recommendations_en)),
        evaluated_at=now_iso,
        is_stale=False,
        evaluation_fingerprint=fingerprint
    )
