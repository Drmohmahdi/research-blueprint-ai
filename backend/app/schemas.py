from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Dict, Any

class SampleSettingsSchema(BaseModel):
    populationSize: Optional[int] = None
    marginOfError: float = 0.05
    confidenceLevel: float = 0.95
    expectedPower: float = 0.80
    expectedEffectSize: float = 0.5
    expectedAttritionRate: float = 0.15
    groupsCount: float = 2.0


class VariableSchema(BaseModel):
    id: str
    nameAr: str
    nameEn: str
    type: str # independent, dependent, mediator, moderator, control
    scale: str # nominal, ordinal, interval, ratio
    maxValue: Optional[float] = None
    minValue: Optional[float] = None
    descriptionAr: Optional[str] = None
    descriptionEn: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class QuestionSchema(BaseModel):
    id: str
    textAr: str
    textEn: str
    associatedVariables: List[str]
    model_config = ConfigDict(from_attributes=True)


class HypothesisSchema(BaseModel):
    id: str
    questionId: Optional[str] = None
    textAr: str
    textEn: str
    type: str # null, directional, non-directional
    independentVarId: Optional[str] = None
    dependentVarId: Optional[str] = None
    mediatorVarId: Optional[str] = None
    moderatorVarId: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class MeasurementInstrumentSchema(BaseModel):
    variableId: str
    name: str
    kind: str
    itemCount: Optional[int] = None
    scoringPlan: str
    validityPlan: str
    reliabilityMethod: str
    reliabilityValue: Optional[float] = None


class HypothesisAnalysisPlanSchema(BaseModel):
    hypothesisId: str
    statisticalTest: str
    assumptionsPlan: str
    effectSizeMetric: str
    notes: Optional[str] = None


class EthicsFeasibilityPlanSchema(BaseModel):
    approvalStatus: str
    consentPlan: str
    privacyPlan: str
    riskMitigationPlan: str


class PreRegistrationRevisionSchema(BaseModel):
    id: str
    protocolVersion: int
    hash: str
    lockedAt: str
    protocolSnapshot: Dict[str, Any]


class ProjectCreate(BaseModel):
    titleAr: str
    titleEn: str
    departmentAr: Optional[str] = None
    departmentEn: Optional[str] = None
    institutionAr: Optional[str] = None
    institutionEn: Optional[str] = None
    descriptionAr: Optional[str] = None
    descriptionEn: Optional[str] = None
    problemStatementAr: Optional[str] = None
    problemStatementEn: Optional[str] = None
    studyDesign: str
    variables: List[VariableSchema]
    questions: List[QuestionSchema]
    hypotheses: List[HypothesisSchema]
    sampleSettings: SampleSettingsSchema
    activePathId: Optional[str] = None
    completedSteps: Optional[List[str]] = None
    objectives: Optional[str] = None
    timeline: Optional[str] = None
    ethics: Optional[str] = None
    ethicsFeasibilityPlan: Optional[EthicsFeasibilityPlanSchema] = None
    measurementInstruments: Optional[List[MeasurementInstrumentSchema]] = None
    hypothesisAnalysisPlans: Optional[List[HypothesisAnalysisPlanSchema]] = None
    preRegistrationHash: Optional[str] = None
    preRegistrationLockedAt: Optional[str] = None
    preRegistrationHistory: Optional[List[PreRegistrationRevisionSchema]] = None


class ProjectResponse(BaseModel):
    id: str
    titleAr: str
    titleEn: str
    departmentAr: Optional[str] = None
    departmentEn: Optional[str] = None
    institutionAr: Optional[str] = None
    institutionEn: Optional[str] = None
    descriptionAr: Optional[str] = None
    descriptionEn: Optional[str] = None
    problemStatementAr: Optional[str] = None
    problemStatementEn: Optional[str] = None
    studyDesign: str
    variables: List[VariableSchema]
    questions: List[QuestionSchema]
    hypotheses: List[HypothesisSchema]
    sampleSettings: SampleSettingsSchema
    preRegistrationHash: Optional[str] = None
    preRegistrationLockedAt: Optional[str] = None
    preRegistrationHistory: Optional[List[PreRegistrationRevisionSchema]] = None
    version: int
    activePathId: Optional[str] = None
    completedSteps: Optional[List[str]] = None
    intelligenceProfile: Optional[Dict[str, Any]] = None
    organizationId: Optional[str] = None
    objectives: Optional[str] = None
    timeline: Optional[str] = None
    ethics: Optional[str] = None
    ethicsFeasibilityPlan: Optional[EthicsFeasibilityPlanSchema] = None
    measurementInstruments: Optional[List[MeasurementInstrumentSchema]] = None
    hypothesisAnalysisPlans: Optional[List[HypothesisAnalysisPlanSchema]] = None
    model_config = ConfigDict(from_attributes=True)


class TitleAnalysisRequest(BaseModel):
    title: str


class TitleAnalysisResponse(BaseModel):
    independentVariables: List[str]
    dependentVariables: List[str]
    mediators: List[str]
    moderators: List[str]
    controls: List[str]
    population: str
    context: str
    suggestedMethodology: str
    confidence: float
    ambiguities: List[str]
    followUpQuestions: List[str]
    isFallback: bool = False


class SimulationParamsSchema(BaseModel):
    preTestMean: float
    preTestSd: float
    expectedGain: float
    gainType: str # fixed, relative, regression
    betaPre: Optional[float] = 0.8
    betaTreatment: Optional[float] = 10.0
    betaEngagement: Optional[float] = 5.0
    errorSd: float = 6.0
    interventionEngagement: float = 0.85
    attritionRate: float = 0.15
    maxScore: float = 100.0
    seed: int = 42
    iterations: int = 1000


class SimulatedStudentRow(BaseModel):
    studentId: str
    group: str
    preScore: float
    postScore: float
    engagement: float
    retained: bool


class SimulationSummary(BaseModel):
    treatmentSize: int
    controlSize: int
    preMeanTreatment: float
    preMeanControl: float
    postMeanTreatment: float
    postMeanControl: float
    meanGainTreatment: float
    meanGainControl: float
    cohensD: float
    pValue: float
    statisticalPower: float
    attritionCount: int
    successProbability: float


class SimulationResponse(BaseModel):
    observedActualData: List[SimulatedStudentRow]
    summary: SimulationSummary


class DataInspectionResponse(BaseModel):
    qualityScore: int
    issues: List[str]


class UserRegister(BaseModel):
    username: str
    password: str
    email: str
    role: str # Researcher, Student, Supervisor, Statistician, OrganizationAdmin, SystemAdmin


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    model_config = ConfigDict(from_attributes=True)


class SessionResponse(BaseModel):
    token: str
    username: str
    role: str


class SimulationJobResponse(BaseModel):
    id: str
    status: str
    progress: int
    sampleSize: int
    createdAt: str
    result: Optional[SimulationResponse] = None
    error: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# ── SaaS Schemas ─────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    slug: str
    organization_type: Optional[str] = "PERSONAL"
    country: Optional[str] = None
    timezone: Optional[str] = None
    billing_email: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    parent_id: Optional[str] = None
    hierarchy_level: int = 0
    organization_type: str
    status: str
    owner_user_id: Optional[str]
    logo_url: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    default_language: Optional[str]
    data_region: Optional[str]
    billing_email: Optional[str] = None
    created_at: str
    model_config = ConfigDict(from_attributes=True)

class OrganizationMembershipResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: str
    status: str
    joined_at: Optional[str]
    created_at: str
    username: Optional[str] = None
    email: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class OrganizationInvitationCreate(BaseModel):
    email: str
    role: str

class OrganizationInvitationResponse(BaseModel):
    id: str
    organization_id: str
    email: str
    role: str
    invited_by: str
    expires_at: str
    accepted_at: Optional[str] = None
    revoked_at: Optional[str] = None
    created_at: str
    model_config = ConfigDict(from_attributes=True)

class PlanResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    billing_interval: str
    price: float
    currency: str
    limits_json: Dict[str, Any]
    features_json: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)

class SubscriptionResponse(BaseModel):
    id: str
    organization_id: str
    plan_id: str
    status: str
    provider: str
    current_period_start: str
    current_period_end: str
    trial_ends_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InvoiceResponse(BaseModel):
    id: str
    organization_id: str
    subscription_id: str
    invoice_number: str
    amount_total: float
    currency: str
    status: str
    issued_at: str
    paid_at: Optional[str] = None
    invoice_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UsageResponse(BaseModel):
    quota: Dict[str, Any]
    usage: Dict[str, Any]

class AuditLogResponse(BaseModel):
    id: str
    userId: Optional[str]
    organizationId: Optional[str]
    action: str
    details: Optional[str]
    timestamp: str
    model_config = ConfigDict(from_attributes=True)

class UploadedFileResponse(BaseModel):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    classification: str
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class IdentifierSchema(BaseModel):
    id: Optional[str] = None
    identifier_type: str
    identifier_value: str
    profile_url: Optional[str] = None
    status: Optional[str] = "UNVERIFIED"
    verification_method: Optional[str] = None
    verified_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)


class AffiliationSchema(BaseModel):
    id: Optional[str] = None
    organization_name: str
    university_id: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    position_title: Optional[str] = None
    academic_rank: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: Optional[bool] = False
    country: Optional[str] = None
    evidence_file_id: Optional[str] = None
    verification_status: Optional[str] = "UNVERIFIED"
    model_config = ConfigDict(from_attributes=True)


class UnifiedAcademicProfileResponse(BaseModel):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    preferred_name_ar: Optional[str] = None
    preferred_name_en: Optional[str] = None
    name_variants_json: Optional[List[str]] = None
    academic_title: Optional[str] = None
    current_rank: Optional[str] = None
    target_rank: Optional[str] = None
    country: Optional[str] = None
    university: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    general_specialization: Optional[str] = None
    specific_specialization: Optional[str] = None
    discipline: Optional[str] = None
    research_interests_json: Optional[List[str]] = None
    keywords_ar_json: Optional[List[str]] = None
    keywords_en_json: Optional[List[str]] = None
    institutional_email: Optional[str] = None
    public_email: Optional[str] = None
    phone: Optional[str] = None
    short_bio_ar: Optional[str] = None
    short_bio_en: Optional[str] = None
    full_bio_ar: Optional[str] = None
    full_bio_en: Optional[str] = None
    profile_photo_file_id: Optional[str] = None
    visibility_status: str
    completeness_score: int
    created_at: str
    updated_at: Optional[str] = None
    identifiers: List[IdentifierSchema] = []
    affiliations: List[AffiliationSchema] = []
    model_config = ConfigDict(from_attributes=True)


class UnifiedAcademicProfileUpsert(BaseModel):
    preferred_name_ar: Optional[str] = None
    preferred_name_en: Optional[str] = None
    name_variants_json: Optional[List[str]] = None
    academic_title: Optional[str] = None
    current_rank: Optional[str] = None
    target_rank: Optional[str] = None
    country: Optional[str] = None
    university: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    general_specialization: Optional[str] = None
    specific_specialization: Optional[str] = None
    discipline: Optional[str] = None
    research_interests_json: Optional[List[str]] = None

    keywords_ar_json: Optional[List[str]] = None
    keywords_en_json: Optional[List[str]] = None
    institutional_email: Optional[str] = None
    public_email: Optional[str] = None
    phone: Optional[str] = None
    short_bio_ar: Optional[str] = None
    short_bio_en: Optional[str] = None
    full_bio_ar: Optional[str] = None
    full_bio_en: Optional[str] = None
    profile_photo_file_id: Optional[str] = None
    visibility_status: Optional[str] = "PUBLIC"
    identifiers: List[IdentifierSchema] = []
    affiliations: List[AffiliationSchema] = []


class ScholarlyAssetContributorSchema(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    external_name: Optional[str] = None
    orcid: Optional[str] = None
    author_order: int = 1
    is_corresponding_author: bool = False
    contribution_roles_json: Optional[List[str]] = None
    affiliation_text: Optional[str] = None
    contribution_percentage: Optional[float] = None
    verified_status: Optional[str] = "UNVERIFIED"
    model_config = ConfigDict(from_attributes=True)


class ScholarlyAssetFileSchema(BaseModel):
    id: Optional[str] = None
    file_id: str
    file_role: str
    version: int = 1
    is_primary: bool = False
    uploaded_by: Optional[str] = None
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ScholarlyAssetResponse(BaseModel):
    id: str
    organization_id: Optional[str] = None
    owner_user_id: str
    created_by: Optional[str] = None
    title_ar: Optional[str] = None
    title_en: Optional[str] = None
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    asset_type: str
    lifecycle_status: str
    primary_discipline: Optional[str] = None
    secondary_disciplines_json: Optional[List[str]] = None
    keywords_json: Optional[List[str]] = None
    doi: Optional[str] = None
    issn: Optional[str] = None
    isbn: Optional[str] = None
    journal_name: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    acceptance_date: Optional[str] = None
    conference_name: Optional[str] = None
    language: str
    visibility: str
    source_module: Optional[str] = None
    source_record_id: Optional[str] = None
    parent_asset_id: Optional[str] = None
    version_number: int
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: Optional[str] = None
    contributors: List[ScholarlyAssetContributorSchema] = []
    files: List[ScholarlyAssetFileSchema] = []
    model_config = ConfigDict(from_attributes=True)


class PublicScholarlyAssetResponse(BaseModel):
    id: str
    title_ar: Optional[str] = None
    title_en: Optional[str] = None
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    asset_type: str
    journal_name: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    conference_name: Optional[str] = None
    doi: Optional[str] = None
    language: str
    model_config = ConfigDict(from_attributes=True)


class PublicIdentifierResponse(BaseModel):
    identifier_type: str
    identifier_value: str
    profile_url: Optional[str] = None
    status: Optional[str] = "UNVERIFIED"
    model_config = ConfigDict(from_attributes=True)


class PublicAffiliationResponse(BaseModel):
    organization_name: str
    college: Optional[str] = None
    department: Optional[str] = None
    position_title: Optional[str] = None
    academic_rank: Optional[str] = None
    is_current: Optional[bool] = False
    country: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class PublicProfileResponse(BaseModel):
    has_photo: bool = False
    preferred_name_ar: Optional[str] = None
    preferred_name_en: Optional[str] = None
    academic_title: Optional[str] = None
    current_rank: Optional[str] = None
    country: Optional[str] = None
    university: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    general_specialization: Optional[str] = None
    specific_specialization: Optional[str] = None
    discipline: Optional[str] = None
    research_interests_json: Optional[List[str]] = None
    keywords_ar_json: Optional[List[str]] = None
    keywords_en_json: Optional[List[str]] = None
    public_email: Optional[str] = None
    short_bio_ar: Optional[str] = None
    short_bio_en: Optional[str] = None
    full_bio_ar: Optional[str] = None
    full_bio_en: Optional[str] = None
    completeness_score: int
    identifiers: List[PublicIdentifierResponse] = []
    affiliations: List[PublicAffiliationResponse] = []
    scholarly_assets: List[PublicScholarlyAssetResponse] = []


class ScholarlyAssetCreate(BaseModel):
    title_ar: Optional[str] = None
    title_en: Optional[str] = None
    abstract_ar: Optional[str] = None
    abstract_en: Optional[str] = None
    asset_type: str
    lifecycle_status: Optional[str] = "DRAFT"
    primary_discipline: Optional[str] = None
    secondary_disciplines_json: Optional[List[str]] = None
    keywords_json: Optional[List[str]] = None
    doi: Optional[str] = None
    issn: Optional[str] = None
    isbn: Optional[str] = None
    journal_name: Optional[str] = None
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    acceptance_date: Optional[str] = None
    conference_name: Optional[str] = None
    language: Optional[str] = "ar"
    visibility: Optional[str] = "PUBLIC"
    source_module: Optional[str] = None
    source_record_id: Optional[str] = None
    parent_asset_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    contributors: List[ScholarlyAssetContributorSchema] = []
    files: List[ScholarlyAssetFileSchema] = []


# ── Literature Synthesis & Studies Schemas ──────────────────────────────────
class LiteratureStudyBase(BaseModel):
    author: str
    year: int
    sampleSize: int = Field(gt=0, description="Sample size must be positive")
    effectSize: float
    ciLower: float
    ciUpper: float
    source: Optional[str] = "manual"
    doi: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_study_bounds(self):
        if self.ciLower > self.ciUpper:
            raise ValueError("Confidence interval lower bound cannot exceed upper bound")
        return self


class LiteratureStudyCreate(LiteratureStudyBase):
    id: Optional[str] = None


class LiteratureStudySchema(LiteratureStudyBase):
    id: str
    projectId: str
    organizationId: Optional[str] = None
    createdAt: str
    updatedAt: str
    model_config = ConfigDict(from_attributes=True)


class LiteratureStudyBatchSyncRequest(BaseModel):
    studies: List[LiteratureStudyCreate]


class LiteratureSynthesisResponse(BaseModel):
    projectId: str
    studies: List[LiteratureStudySchema]
    totalStudies: int
    totalSampleCount: int
    pooledEffectSize: float
    pooledLower: float
    pooledUpper: float
    heterogeneityQ: float
    heterogeneityI2: float


# ── PRISMA Flow Schemas ─────────────────────────────────────────────────────
class PrismaFlowBase(BaseModel):
    identified: int = Field(ge=0, default=0)
    duplicates: int = Field(ge=0, default=0)
    excludedScreening: int = Field(ge=0, default=0)
    excludedEligibility: int = Field(ge=0, default=0)
    source: Optional[str] = "manual"
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_prisma_counts(self):
        if self.duplicates > self.identified:
            raise ValueError("Duplicates removed cannot exceed identified records")
        screened = self.identified - self.duplicates
        if self.excludedScreening > screened:
            raise ValueError("Records excluded during screening cannot exceed screened records")
        eligible = screened - self.excludedScreening
        if self.excludedEligibility > eligible:
            raise ValueError("Full-text reports excluded cannot exceed eligible reports sought")
        return self


class PrismaFlowUpsertRequest(PrismaFlowBase):
    pass


class PrismaFlowResponse(PrismaFlowBase):
    id: str
    projectId: str
    organizationId: Optional[str] = None
    screened: int = 0
    eligible: int = 0
    included: int = 0
    createdAt: str
    updatedAt: str
    model_config = ConfigDict(from_attributes=True)


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
    policy: Optional[PromotionPolicyResponse] = None
    model_config = ConfigDict(from_attributes=True)


class HumanReviewDecisionRequest(BaseModel):
    decision: str # ELIGIBLE_RECOMMENDED, INELIGIBLE_DEFICIENT, REQUIRES_FURTHER_DOCS
    notes: str


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
    project_id: Optional[str] = None
    scholarly_asset_id: Optional[str] = None
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
    active_assignments_count: int = 0
    completed_reviews_count: int = 0
    created_at: str
    updated_at: str
    model_config = ConfigDict(from_attributes=True)


class EditorialDecisionRequest(BaseModel):
    decision: str # ACCEPTED, REVISION_REQUIRED, REJECTED
    decision_notes: str


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


# --- Phase 05: Academic Reporting & Export Schemas ---

class ReportExportRequest(BaseModel):
    report_type: str = Field(..., description="RESEARCH_PROJECT, LITERATURE_SYNTHESIS, PRISMA_FLOW, PROMOTION_READINESS, PEER_REVIEW, ACADEMIC_PROFILE, THESIS_PROGRESS")
    source_id: str = Field(..., description="ID of the underlying domain entity")
    format: str = Field("PDF", description="PDF, DOCX, JSON")
    language: str = Field("ar", description="ar, en, bilingual")
    audience: str = Field("RESEARCHER", description="RESEARCHER, AUTHOR, SUPERVISOR, COMMITTEE, ADMIN, PUBLIC")
    template_version: str = Field("academic-standard-v1", description="Report template version")


class ReportVerificationResponse(BaseModel):
    valid: bool
    verification_code: str
    report_type: Optional[str] = None
    organization_name: Optional[str] = None
    generated_at: Optional[str] = None
    document_hash: Optional[str] = None
    message: str


# --- Phase 06: Academic Workflow Events & Notification Schemas ---

class NotificationResponse(BaseModel):
    id: str
    organization_id: str
    recipient_user_id: str
    category: str
    title_ar: str
    title_en: str
    message_ar: str
    message_en: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    read_at: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    limit: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferenceItem(BaseModel):
    category: str
    in_app_enabled: bool = True
    email_enabled: bool = True
    updated_at: Optional[str] = None


class NotificationPreferencesResponse(BaseModel):
    preferences: List[NotificationPreferenceItem]


class NotificationPreferencesUpdateRequest(BaseModel):
    preferences: List[NotificationPreferenceItem]


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 09 — UNIFIED SEARCH & ACADEMIC DISCOVERY
# ─────────────────────────────────────────────────────────────────────────────

ALLOWED_SEARCH_DOMAINS = [
    "PROJECT", "LITERATURE", "ASSET", "PROFILE",
    "PROMOTION", "PEER_REVIEW", "FILE"
]

ALLOWED_SEARCH_SORTS = ["relevance", "newest", "oldest", "title", "year"]

class SearchResultItem(BaseModel):
    domain: str
    entity_id: str
    title: str
    subtitle: Optional[str] = None
    snippet: Optional[str] = None
    status: Optional[str] = None
    updated_at: Optional[str] = None
    target: Optional[str] = None
    metadata: Dict[str, Any] = {}

class SearchResponse(BaseModel):
    query: str
    domains: List[str]
    total: int
    page: int
    limit: int
    total_pages: int
    results: List[SearchResultItem]
    domain_counts: Dict[str, int]
    hidden_domains: List[str] = []


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 10 — GOVERNED ACADEMIC AI
# ─────────────────────────────────────────────────────────────────────────────

class AISource(BaseModel):
    type: str
    source_id: str
    title: Optional[str] = None


class AIUsageSummary(BaseModel):
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    estimated_tokens: Optional[int] = None


class AIResponse(BaseModel):
    use_case: str
    prompt_version: int
    provider: str
    model: Optional[str] = None
    text: str
    structured: Optional[Dict[str, Any]] = None
    sources: List[AISource] = []
    grounded: bool = False
    requires_verification: bool = True
    human_authority: bool = True
    ai_generated: bool = True
    usage: Optional[AIUsageSummary] = None


