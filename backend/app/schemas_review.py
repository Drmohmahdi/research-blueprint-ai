from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any

# ── Peer Review Workflow Schemas ───────────────────────────────────────────────

class ReviewCriterionBase(BaseModel):
    code: str
    title_ar: str
    title_en: str
    desc_ar: Optional[str] = None
    desc_en: Optional[str] = None
    response_type: str = "SCORE" # SCORE, YES_NO, TEXT, CHOICE
    weight: float = 1.0
    is_mandatory: bool = True
    sort_order: int = 1
    options_json: Optional[Dict[str, Any]] = None


class ReviewCriterionCreate(ReviewCriterionBase):
    pass


class ReviewCriterionResponse(ReviewCriterionBase):
    id: str
    rubric_id: str
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class ReviewRubricCreate(BaseModel):
    name_ar: str
    name_en: str
    rubric_type: str = "GENERAL_MANUSCRIPT"
    is_default: bool = False
    criteria: List[ReviewCriterionCreate] = []


class ReviewRubricResponse(BaseModel):
    id: str
    organization_id: str
    name_ar: str
    name_en: str
    rubric_type: str
    version: int
    is_default: bool
    status: str
    created_at: str
    criteria: List[ReviewCriterionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PeerReviewCaseCreate(BaseModel):
    title_ar: str
    title_en: str
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    discipline: Optional[str] = None
    case_type: str = "MANUSCRIPT"  # MANUSCRIPT, PROPOSAL, STUDY_DESIGN, PROMOTION_DOSSIER
    blind_type: str = "DOUBLE_BLIND"  # SINGLE_BLIND, DOUBLE_BLIND, OPEN
    project_id: Optional[str] = None
    scholarly_asset_id: Optional[str] = None
    rubric_id: Optional[str] = None
    # Optional exact-version binding to Publication Intelligence. Only the ID
    # is client-supplied; the fingerprint is always re-derived server-side
    # from the referenced PublicationManuscriptVersion, never trusted from
    # the client, to prevent a caller from asserting a fingerprint that does
    # not match the actual manuscript content.
    manuscript_version_id: Optional[str] = None


class ReviewCommentResponse(BaseModel):
    id: str
    submission_id: str
    case_id: str
    round_id: str
    section_key: Optional[str] = None
    comment_type: str
    comment_text: str
    author_response_text: Optional[str] = None
    is_resolved: bool = False
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class ReviewCommentCreate(BaseModel):
    section_key: Optional[str] = None
    comment_type: str = "AUTHOR_VISIBLE" # AUTHOR_VISIBLE, CONFIDENTIAL_TO_EDITOR
    comment_text: str


class ReviewCriterionResponseItem(BaseModel):
    criterion_id: str
    score_value: Optional[float] = None
    text_value: Optional[str] = None
    choice_value: Optional[str] = None
    comments: Optional[str] = None


class ReviewCriterionResponseSchema(BaseModel):
    id: str
    criterion_id: str
    score_value: Optional[float] = None
    text_value: Optional[str] = None
    choice_value: Optional[str] = None
    comments: Optional[str] = None
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class ReviewSubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    round_id: str
    case_id: str
    status: str # DRAFT, SUBMITTED
    recommendation: str # ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT
    summary_evaluation_ar: Optional[str] = None
    summary_evaluation_en: Optional[str] = None
    total_weighted_score: float
    is_confidential_to_editor: bool
    submitted_at: Optional[str] = None
    created_at: str
    updated_at: str
    responses: List[ReviewCriterionResponseSchema] = []
    comments: List[ReviewCommentResponse] = []
    model_config = ConfigDict(from_attributes=True)


class ReviewSubmissionDraftRequest(BaseModel):
    recommendation: Optional[str] = "MINOR_REVISION"
    summary_evaluation_ar: Optional[str] = None
    summary_evaluation_en: Optional[str] = None
    is_confidential_to_editor: Optional[bool] = False
    responses: List[ReviewCriterionResponseItem] = []
    comments: List[ReviewCommentCreate] = []


class ReviewSubmissionFinalRequest(BaseModel):
    recommendation: str # ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT
    summary_evaluation_ar: Optional[str] = None
    summary_evaluation_en: Optional[str] = None
    is_confidential_to_editor: Optional[bool] = False
    responses: List[ReviewCriterionResponseItem] = []
    comments: List[ReviewCommentCreate] = []


class ReviewerAssignmentCreate(BaseModel):
    reviewer_type: str = "INTERNAL_REVIEWER" # INTERNAL_REVIEWER, EXTERNAL_REVIEWER
    reviewer_user_id: Optional[str] = None
    external_email: Optional[str] = None
    external_name: Optional[str] = None
    due_at: Optional[str] = None


class ReviewerAssignmentResponse(BaseModel):
    id: str
    case_id: str
    round_id: str
    reviewer_type: str
    reviewer_user_id: Optional[str] = None
    external_email: Optional[str] = None
    external_name: Optional[str] = None
    status: str
    conflict_status: str
    conflict_notes: Optional[str] = None
    decline_reason: Optional[str] = None
    due_at: Optional[str] = None
    invited_at: str
    accepted_at: Optional[str] = None
    submitted_at: Optional[str] = None
    created_at: str
    submission: Optional[ReviewSubmissionResponse] = None
    magic_link_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ReviewerAcceptRequest(BaseModel):
    conflict_status: str = "NO_CONFLICT" # NO_CONFLICT, POTENTIAL_CONFLICT, CONFLICT_DECLARED
    conflict_notes: Optional[str] = None


class ReviewerDeclineRequest(BaseModel):
    decline_reason: Optional[str] = None


class ManuscriptRevisionCreate(BaseModel):
    title_ar: str
    title_en: str
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    response_to_reviewers: Optional[str] = None
    file_id: Optional[str] = None


class ManuscriptRevisionResponse(BaseModel):
    id: str
    case_id: str
    round_id: Optional[str] = None
    version_number: int
    title_ar: str
    title_en: str
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    response_to_reviewers: Optional[str] = None
    file_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class PeerReviewRoundResponse(BaseModel):
    id: str
    case_id: str
    round_number: int
    manuscript_version: int
    status: str
    manuscript_snapshot_json: Optional[Dict[str, Any]] = None
    rubric_id: Optional[str] = None
    rubric_snapshot_json: Optional[Dict[str, Any]] = None
    decision: str
    decision_notes: Optional[str] = None
    decision_by_user_id: Optional[str] = None
    decision_at: Optional[str] = None
    created_at: str
    rubric: Optional[ReviewRubricResponse] = None
    assignments: List[ReviewerAssignmentResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PeerReviewCaseResponse(BaseModel):
    id: str
    organization_id: str
    owner_user_id: Optional[str] = None # Masked in double-blind for reviewers
    author_name: Optional[str] = None # Masked in double-blind for reviewers
    editor_user_id: Optional[str] = None
    is_editor: bool = False  # server-computed: does the CALLER hold editorial authority over this case
    project_id: Optional[str] = None
    scholarly_asset_id: Optional[str] = None
    manuscript_version_id: Optional[str] = None
    manuscript_fingerprint: Optional[str] = None
    publication_submission_id: Optional[str] = None
    title_ar: str
    title_en: str
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    discipline: Optional[str] = None
    case_type: str
    blind_type: str
    status: str
    current_round_number: int
    created_at: str
    updated_at: str
    rounds: List[PeerReviewRoundResponse] = []
    revisions: List[ManuscriptRevisionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class PeerReviewCaseSummaryResponse(BaseModel):
    id: str
    organization_id: str
    title_ar: str
    title_en: str
    case_type: str
    blind_type: str
    status: str
    current_round_number: int
    is_editor: bool = False  # server-computed: does the CALLER hold editorial authority over this case
    active_assignments_count: int = 0
    completed_reviews_count: int = 0
    created_at: str
    updated_at: str
    model_config = ConfigDict(from_attributes=True)


class EditorialDecisionRequest(BaseModel):
    decision: str # ACCEPTED, REVISION_REQUIRED, REJECTED
    decision_notes: str


class EditorAssignmentRequest(BaseModel):
    editor_user_id: str


class ExternalReviewerPortalResponse(BaseModel):
    assignment_id: str
    case_id: str
    round_id: str
    round_number: int
    manuscript_version: int
    manuscript_title: str
    manuscript_abstract: Optional[str] = None
    case_type: str
    blind_type: str
    due_at: Optional[str] = None
    assignment_status: str
    conflict_status: str
    reviewer_name: Optional[str] = None
    rubric: Optional[ReviewRubricResponse] = None
    submission: Optional[ReviewSubmissionResponse] = None


