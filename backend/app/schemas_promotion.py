from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any

# ── Academic Promotion Schemas ──────────────────────────────────────────────

class PromotionCriterionBase(BaseModel):
    code: str
    title_ar: str
    title_en: str
    criterion_type: str = "RESEARCH_OUTPUT"
    required_points: float = 0.0
    min_asset_count: int = 0
    rule_definition_json: Dict[str, Any] = {}
    weight: float = 1.0
    is_mandatory: bool = True
    sort_order: int = 1


class PromotionCriterionCreate(PromotionCriterionBase):
    id: Optional[str] = None


class PromotionCriterionResponse(PromotionCriterionBase):
    id: str
    policy_id: str
    organization_id: str
    created_at: str
    model_config = ConfigDict(from_attributes=True)



class PromotionPolicyCreate(BaseModel):
    name_ar: str
    name_en: str
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    target_rank: str
    status: str = "ACTIVE"
    is_default: bool = False
    rules_json: Optional[Dict[str, Any]] = None
    criteria: Optional[List[PromotionCriterionCreate]] = None


class PromotionPolicyUpdate(BaseModel):
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    target_rank: Optional[str] = None
    status: Optional[str] = None
    is_default: Optional[bool] = None
    rules_json: Optional[Dict[str, Any]] = None


class PromotionPolicyResponse(BaseModel):
    id: str
    organization_id: str
    name_ar: str
    name_en: str
    description_ar: Optional[str] = None
    description_en: Optional[str] = None
    target_rank: str
    version: int
    status: str
    is_default: bool
    rules_json: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str
    criteria: List[PromotionCriterionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PromotionEvidenceSelectRequest(BaseModel):
    scholarly_asset_ids: List[str]
    criterion_id: Optional[str] = None


class PromotionEvidenceItemResponse(BaseModel):
    id: str
    promotion_application_id: str
    scholarly_asset_id: str
    criterion_id: Optional[str] = None
    eligibility_status: str
    calculated_points: float
    evidence_status: str
    evidence_snapshot_json: Optional[Dict[str, Any]] = None
    verification_status: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CriterionEvaluationResult(BaseModel):
    criterion_id: str
    code: str
    title_ar: str
    title_en: str
    criterion_type: str
    is_mandatory: bool
    status: str # SATISFIED, PARTIALLY_SATISFIED, NOT_SATISFIED, MISSING_EVIDENCE
    required_value: float
    actual_value: float
    required_count: int
    actual_count: int
    points_earned: float
    evidence_asset_ids: List[str] = []
    explanation_ar: str
    explanation_en: str
    missing_items: List[str] = []


class PromotionEvaluationResult(BaseModel):
    application_id: str
    policy_id: str
    policy_name_ar: str
    policy_name_en: str
    policy_version: int
    target_rank: str
    readiness_percentage: int
    is_fully_ready: bool
    total_calculated_points: float
    total_required_points: float
    total_evidence_count: int
    mandatory_criteria_satisfied: bool
    criteria_results: List[CriterionEvaluationResult]
    recommendations_ar: List[str] = []
    recommendations_en: List[str] = []
    evaluated_at: str
    is_stale: bool = False
    evaluation_fingerprint: str
    disclaimer_ar: str = "هذا التقييم استرشادي لدعم القرار ولا يعتبر قرار ترقية نهائي؛ القرار النهائي معقود للجنة الأكاديمية المختصة."
    disclaimer_en: str = "This readiness evaluation is a decision-support advisory tool and does not constitute a final promotion decision. Final determination is strictly reserved for the institutional academic committee."


class PromotionCommitteeAssignmentResponse(BaseModel):
    id: str
    application_id: str
    user_id: str
    assigned_by: Optional[str] = None
    status: str
    assigned_at: str
    revoked_at: Optional[str] = None
    revoked_by: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PromotionApplicationCreate(BaseModel):
    policy_id: Optional[str] = None
    target_rank: str
    current_rank: Optional[str] = None


class PromotionApplicationResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    policy_id: str
    policy_version: int
    current_rank: Optional[str] = None
    target_rank: str
    status: str
    readiness_percentage: int
    total_calculated_points: float
    evaluation_summary_json: Optional[Dict[str, Any]] = None
    evaluation_fingerprint: Optional[str] = None
    human_review_decision: Optional[str] = None
    human_review_notes: Optional[str] = None
    reviewer_user_id: Optional[str] = None
    reviewed_at: Optional[str] = None
    submitted_at: Optional[str] = None
    created_at: str
    updated_at: str
    evidence_selections: List[PromotionEvidenceItemResponse] = []
    committee_assignments: List[PromotionCommitteeAssignmentResponse] = []
    is_committee_member: bool = False
    policy: Optional[PromotionPolicyResponse] = None
    model_config = ConfigDict(from_attributes=True)


class PromotionApplicationAdminMetadataResponse(BaseModel):
    """Administrative workflow-oversight view for an org OWNER/ORGANIZATION_ADMIN
    who is NOT an assigned committee member — deliberately excludes every field
    classified as private academic-dossier content (evidence, evaluation detail,
    readiness/points, committee notes, decision rationale). Distinguishable from
    PromotionApplicationResponse by callers via the is_admin_metadata_only flag."""
    id: str
    organization_id: str
    user_id: str
    policy_id: str
    policy_version: int
    current_rank: Optional[str] = None
    target_rank: str
    status: str
    committee_assignment_count: int
    has_committee_assigned: bool
    decision_status: Optional[str] = None
    decision_recorded_at: Optional[str] = None
    submitted_at: Optional[str] = None
    created_at: str
    updated_at: str
    is_admin_metadata_only: bool = True
    model_config = ConfigDict(from_attributes=True)


class HumanReviewDecisionRequest(BaseModel):
    decision: str # ELIGIBLE_RECOMMENDED, INELIGIBLE_DEFICIENT, REQUIRES_FURTHER_DOCS
    notes: str


class PromotionCommitteeAssignRequest(BaseModel):
    user_id: str


