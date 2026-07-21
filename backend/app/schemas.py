from pydantic import BaseModel, ConfigDict, Field
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




