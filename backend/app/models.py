from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from .db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False) # Researcher, Student, Supervisor, Statistician, OrganizationAdmin, SystemAdmin
    created_at = Column(String, nullable=False)

    # Relationships
    memberships = relationship("OrganizationMembership", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    token = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expiresAt = Column(String, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    request_id = Column(String, nullable=True)
    timestamp = Column(String, nullable=False)


class ResearchProject(Base):
    __tablename__ = "research_projects"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    titleAr = Column(String, nullable=False)
    titleEn = Column(String, nullable=False)
    departmentAr = Column(String, nullable=True)
    departmentEn = Column(String, nullable=True)
    institutionAr = Column(String, nullable=True)
    institutionEn = Column(String, nullable=True)
    descriptionAr = Column(String, nullable=True)
    descriptionEn = Column(String, nullable=True)
    problemStatementAr = Column(String, nullable=True)
    problemStatementEn = Column(String, nullable=True)
    studyDesign = Column(String, default="quasi_experimental_pre_post")
    
    # JSON column for sampleSettings
    sampleSettings = Column(JSON, nullable=False)
    
    preRegistrationHash = Column(String, nullable=True)
    preRegistrationLockedAt = Column(String, nullable=True)
    preRegistrationHistory = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    
    # Workflow & Profile fields
    activePathId = Column(String, nullable=True)
    completedSteps = Column(JSON, nullable=True)
    intelligenceProfile = Column(JSON, nullable=True)
    objectives = Column(String, nullable=True)
    timeline = Column(String, nullable=True)
    ethics = Column(String, nullable=True)
    ethicsFeasibilityPlan = Column(JSON, nullable=True)
    measurementInstruments = Column(JSON, nullable=True)
    hypothesisAnalysisPlans = Column(JSON, nullable=True)
    scholarly_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    scholarly_asset = relationship("ScholarlyAsset", foreign_keys=[scholarly_asset_id])
    variables = relationship("ResearchVariable", back_populates="project", cascade="all, delete-orphan")
    questions = relationship("ResearchQuestion", back_populates="project", cascade="all, delete-orphan")
    hypotheses = relationship("Hypothesis", back_populates="project", cascade="all, delete-orphan")



class ResearchVariable(Base):
    __tablename__ = "research_variables"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    nameAr = Column(String, nullable=False)
    nameEn = Column(String, nullable=False)
    type = Column(String, nullable=False)  # independent, dependent, mediator, moderator, control
    scale = Column(String, nullable=False) # nominal, ordinal, interval, ratio
    maxValue = Column(Float, nullable=True)
    minValue = Column(Float, nullable=True)
    descriptionAr = Column(String, nullable=True)
    descriptionEn = Column(String, nullable=True)

    project = relationship("ResearchProject", back_populates="variables")


class ResearchQuestion(Base):
    __tablename__ = "research_questions"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    textAr = Column(String, nullable=False)
    textEn = Column(String, nullable=False)
    associatedVariables = Column(JSON, nullable=False)  # list of variable IDs

    project = relationship("ResearchProject", back_populates="questions")


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    questionId = Column(String, nullable=True)
    textAr = Column(String, nullable=False)
    textEn = Column(String, nullable=False)
    type = Column(String, nullable=False) # null, directional, non-directional
    independentVarId = Column(String, nullable=True)
    dependentVarId = Column(String, nullable=True)
    mediatorVarId = Column(String, nullable=True)
    moderatorVarId = Column(String, nullable=True)

    project = relationship("ResearchProject", back_populates="hypotheses")


class SimulationJob(Base):
    __tablename__ = "simulation_jobs"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="PENDING") # PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    progress = Column(Integer, default=0)
    sampleSize = Column(Integer, nullable=False)
    params = Column(JSON, nullable=False)
    result = Column(JSON, nullable=True)
    error = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)


class PredictionModel(Base):
    __tablename__ = "prediction_models"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    version = Column(String, nullable=False)
    createdAt = Column(String, nullable=False)
    status = Column(String, default="ACTIVE") # ACTIVE, DEPRECATED, EXPERIMENTAL


class PredictionModelVersion(Base):
    __tablename__ = "prediction_model_versions"

    id = Column(String, primary_key=True, index=True)
    modelId = Column(String, ForeignKey("prediction_models.id", ondelete="CASCADE"), nullable=False)
    version = Column(String, nullable=False)
    trainingMetrics = Column(JSON, nullable=False)
    features = Column(JSON, nullable=False)
    createdAt = Column(String, nullable=False)


class PredictionTrainingDataset(Base):
    __tablename__ = "prediction_training_datasets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    dataRowsCount = Column(Integer, nullable=False)
    features = Column(JSON, nullable=False)
    isSynthetic = Column(Boolean, default=False)
    createdAt = Column(String, nullable=False)


class PredictionFeature(Base):
    __tablename__ = "prediction_features"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    importance = Column(Float, nullable=False)


class PredictionRun(Base):
    __tablename__ = "prediction_runs"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    modelVersionId = Column(String, ForeignKey("prediction_model_versions.id", ondelete="SET NULL"), nullable=True)
    forecastMode = Column(String, nullable=False) # LITERATURE_BASED_FORECAST, PILOT_UPDATED_FORECAST, IN_STUDY_DYNAMIC_FORECAST, HISTORICAL_MODEL_PREDICTION
    dataProvenance = Column(String, nullable=False)
    assumptions = Column(JSON, nullable=False)
    confidenceQualityScore = Column(Integer, nullable=False)
    createdAt = Column(String, nullable=False)
    createdBy = Column(String, nullable=True)


class PredictionScenario(Base):
    __tablename__ = "prediction_scenarios"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    scenarioName = Column(String, nullable=False) # NULL_EFFECT, CONSERVATIVE, EXPECTED, OPTIMISTIC, WORST_CASE
    assumptions = Column(JSON, nullable=False)
    expectedEffectSize = Column(Float, nullable=False)
    expectedPower = Column(Float, nullable=False)
    expectedPostMeanTreatment = Column(Float, nullable=False)
    expectedPostMeanControl = Column(Float, nullable=False)
    pValue = Column(Float, nullable=False)
    retained = Column(Float, nullable=False)
    attrition = Column(Float, nullable=False)
    predictionIntervalLower = Column(Float, nullable=False)
    predictionIntervalUpper = Column(Float, nullable=False)


class PredictionResult(Base):
    __tablename__ = "prediction_results"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    pointEstimate = Column(Float, nullable=False)
    lowerInterval = Column(Float, nullable=False)
    upperInterval = Column(Float, nullable=False)
    confidenceQualityScore = Column(Integer, nullable=False)


class HypothesisForecast(Base):
    __tablename__ = "hypothesis_forecasts"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    hypothesisId = Column(String, nullable=False)
    probabilitySupported = Column(Float, nullable=False)


class StudentPrediction(Base):
    __tablename__ = "student_predictions"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    studentId = Column(String, nullable=False)
    predictedPostScore = Column(Float, nullable=False)
    predictedRetentionProbability = Column(Float, nullable=False)


class GroupPrediction(Base):
    __tablename__ = "group_predictions"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    groupName = Column(String, nullable=False)
    predictedMean = Column(Float, nullable=False)
    predictedVariance = Column(Float, nullable=False)


class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id = Column(String, primary_key=True, index=True)
    modelVersionId = Column(String, ForeignKey("prediction_model_versions.id", ondelete="CASCADE"), nullable=False)
    metricName = Column(String, nullable=False)
    metricValue = Column(Float, nullable=False)


class PredictionExplanation(Base):
    __tablename__ = "prediction_explanations"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    explanationType = Column(String, nullable=False)
    data = Column(JSON, nullable=False)


class PredictedObservedComparison(Base):
    __tablename__ = "predicted_observed_comparisons"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    observedDatasetName = Column(String, nullable=False)
    metrics = Column(JSON, nullable=False)


class PredictionRecommendation(Base):
    __tablename__ = "prediction_recommendations"

    id = Column(String, primary_key=True, index=True)
    runId = Column(String, ForeignKey("prediction_runs.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    rationale = Column(String, nullable=False)
    priority = Column(String, nullable=False) # HIGH, MEDIUM, LOW
    expectedImpact = Column(String, nullable=True)
    effort = Column(String, nullable=True)
    affectedMetric = Column(String, nullable=True)
    evidenceSource = Column(String, nullable=True)
    uncertainty = Column(String, nullable=True)


class ProjectComment(Base):
    __tablename__ = "project_comments"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    authorId = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    authorUsername = Column(String, nullable=True)
    fieldKey = Column(String, nullable=True)
    step = Column(String, nullable=True)
    contentAr = Column(String, nullable=False)
    contentEn = Column(String, nullable=True)
    resolved = Column(Boolean, default=False)
    priority = Column(String, default="NORMAL")
    createdAt = Column(String, nullable=False)
    resolvedAt = Column(String, nullable=True)


# ── SaaS Multi-Tenancy Models ──────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    parent_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    hierarchy_level = Column(Integer, default=0) # 0: University, 1: College, 2: Department
    organization_type = Column(String, nullable=False, default="PERSONAL")
    status = Column(String, nullable=False, default="ACTIVE")
    owner_user_id = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    country = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    default_language = Column(String, nullable=True, default="ar")
    data_region = Column(String, nullable=True, default="sa")
    billing_email = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)
    suspended_at = Column(String, nullable=True)
    deleted_at = Column(String, nullable=True)

    # Relationships
    memberships = relationship("OrganizationMembership", back_populates="organization", cascade="all, delete-orphan")
    parent = relationship("Organization", remote_side=[id], backref="children")


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default="RESEARCHER") # OWNER, ORGANIZATION_ADMIN, SUPERVISOR, RESEARCHER, VIEWER
    status = Column(String, nullable=False, default="ACTIVE") # INVITED, ACTIVE, SUSPENDED, REMOVED
    invited_by = Column(String, nullable=True)
    joined_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="memberships")
    user = relationship("User", back_populates="memberships")


class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False, default="RESEARCHER")
    token_hash = Column(String, unique=True, index=True, nullable=False)
    invited_by = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(String, nullable=False)
    accepted_at = Column(String, nullable=True)
    revoked_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # PERSONAL_FREE, RESEARCHER_PRO, etc.
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    billing_interval = Column(String, nullable=False, default="MONTHLY") # MONTHLY, YEARLY
    price = Column(Float, nullable=False, default=0.0)
    currency = Column(String, nullable=False, default="SAR")
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)
    trial_days = Column(Integer, default=0)
    limits_json = Column(JSON, nullable=False)
    features_json = Column(JSON, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(String, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="ACTIVE") # TRIALING, ACTIVE, PAST_DUE, PAUSED, CANCELLED, EXPIRED
    provider = Column(String, nullable=False, default="MOCK") # MOCK, MANUAL, STRIPE
    provider_customer_id = Column(String, nullable=True)
    provider_subscription_id = Column(String, nullable=True)
    current_period_start = Column(String, nullable=False)
    current_period_end = Column(String, nullable=False)
    trial_ends_at = Column(String, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(String, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    provider_invoice_id = Column(String, nullable=True)
    invoice_number = Column(String, nullable=False)
    amount_subtotal = Column(Float, nullable=False)
    amount_tax = Column(Float, nullable=False, default=0.0)
    amount_total = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="SAR")
    status = Column(String, nullable=False, default="PAID") # DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE
    issued_at = Column(String, nullable=False)
    due_at = Column(String, nullable=True)
    paid_at = Column(String, nullable=True)
    invoice_url = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String, nullable=False) # AI_REQUEST, PREDICTION_RUN, REPORT_EXPORT, FILE_UPLOAD_BYTES
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    quantity = Column(Float, nullable=False, default=1.0)
    unit = Column(String, nullable=False, default="count")
    metadata_json = Column(JSON, nullable=True)
    occurred_at = Column(String, nullable=False)
    billing_period = Column(String, nullable=False) # YYYY-MM format


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=True)
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    storage_key = Column(String, unique=True, index=True, nullable=False)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    checksum = Column(String, nullable=True)
    classification = Column(String, nullable=False, default="INTERNAL") # PUBLIC, INTERNAL, CONFIDENTIAL_RESEARCH, RESTRICTED_PARTICIPANT_DATA
    scan_status = Column(String, nullable=False, default="UNSCANNED") # UNSCANNED, CLEAN, INFECTED
    created_at = Column(String, nullable=False)
    deleted_at = Column(String, nullable=True)


class AcademicIdentityProfile(Base):
    __tablename__ = "core_academic_identity_profiles"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    preferredNameAr = Column(String, nullable=True)
    preferredNameEn = Column(String, nullable=True)
    nameVariants = Column(String, nullable=True)
    discipline = Column(String, nullable=True)
    researchInterests = Column(String, nullable=True)
    keywords = Column(String, nullable=True)
    shortBio = Column(String, nullable=True)
    fullBio = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)


class AcademicChannel(Base):
    __tablename__ = "core_academic_channels"

    id = Column(String, primary_key=True, index=True)
    profileId = Column(String, ForeignKey("core_academic_identity_profiles.id", ondelete="CASCADE"), nullable=False)
    channelName = Column(String, nullable=False)  # ORCID, Scholar, Scopus, ResearchGate, LinkedIn, GitHub
    profileUrl = Column(String, nullable=True)
    externalId = Column(String, nullable=True)
    status = Column(String, default="missing")  # linked, missing, optional
    completenessScore = Column(Integer, default=0)
    lastSync = Column(String, nullable=True)


class UnifiedAcademicProfile(Base):
    __tablename__ = "core_unified_academic_profiles"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    preferred_name_ar = Column(String, nullable=True)
    preferred_name_en = Column(String, nullable=True)
    name_variants_json = Column(JSON, nullable=True)
    academic_title = Column(String, nullable=True)
    current_rank = Column(String, nullable=True)
    target_rank = Column(String, nullable=True)
    country = Column(String, nullable=True)
    university = Column(String, nullable=True)
    college = Column(String, nullable=True)
    department = Column(String, nullable=True)
    general_specialization = Column(String, nullable=True)
    specific_specialization = Column(String, nullable=True)
    discipline = Column(String, nullable=True)
    research_interests_json = Column(JSON, nullable=True)

    keywords_ar_json = Column(JSON, nullable=True)
    keywords_en_json = Column(JSON, nullable=True)
    institutional_email = Column(String, nullable=True)
    public_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    short_bio_ar = Column(String, nullable=True)
    short_bio_en = Column(String, nullable=True)
    full_bio_ar = Column(String, nullable=True)
    full_bio_en = Column(String, nullable=True)
    profile_photo_file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    visibility_status = Column(String, default="PUBLIC")
    completeness_score = Column(Integer, default=0)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)

    user = relationship("User")
    organization = relationship("Organization")
    identifiers = relationship("AcademicIdentifier", back_populates="profile", cascade="all, delete-orphan")
    affiliations = relationship("AcademicAffiliation", back_populates="profile", cascade="all, delete-orphan")


class AcademicIdentifier(Base):
    __tablename__ = "core_academic_identifiers"

    id = Column(String, primary_key=True, index=True)
    profile_id = Column(String, ForeignKey("core_unified_academic_profiles.id", ondelete="CASCADE"), nullable=False)
    identifier_type = Column(String, nullable=False)
    identifier_value = Column(String, nullable=False)
    profile_url = Column(String, nullable=True)
    status = Column(String, default="UNVERIFIED")
    verification_method = Column(String, nullable=True)
    verified_at = Column(String, nullable=True)
    last_checked_at = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    profile = relationship("UnifiedAcademicProfile", back_populates="identifiers")


class AcademicAffiliation(Base):
    __tablename__ = "core_academic_affiliations"

    id = Column(String, primary_key=True, index=True)
    profile_id = Column(String, ForeignKey("core_unified_academic_profiles.id", ondelete="CASCADE"), nullable=False)
    organization_name = Column(String, nullable=False)
    university_id = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    college = Column(String, nullable=True)
    department = Column(String, nullable=True)
    position_title = Column(String, nullable=True)
    academic_rank = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    is_current = Column(Boolean, default=False)
    country = Column(String, nullable=True)
    evidence_file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    verification_status = Column(String, default="UNVERIFIED")

    profile = relationship("UnifiedAcademicProfile", back_populates="affiliations")


class ScholarlyAsset(Base):
    __tablename__ = "core_scholarly_assets"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    owner_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(String, nullable=True)
    title_ar = Column(String, nullable=True)
    title_en = Column(String, nullable=True)
    abstract_ar = Column(String, nullable=True)
    abstract_en = Column(String, nullable=True)
    asset_type = Column(String, nullable=False)
    lifecycle_status = Column(String, default="DRAFT")
    primary_discipline = Column(String, nullable=True)
    secondary_disciplines_json = Column(JSON, nullable=True)
    keywords_json = Column(JSON, nullable=True)
    doi = Column(String, nullable=True)
    issn = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    journal_name = Column(String, nullable=True)
    publisher = Column(String, nullable=True)
    publication_date = Column(String, nullable=True)
    acceptance_date = Column(String, nullable=True)
    conference_name = Column(String, nullable=True)
    language = Column(String, default="ar")
    visibility = Column(String, default="PUBLIC")
    source_module = Column(String, nullable=True)
    source_record_id = Column(String, nullable=True)
    parent_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="SET NULL"), nullable=True)
    version_number = Column(Integer, default=1)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)
    deleted_at = Column(String, nullable=True)

    organization = relationship("Organization")
    owner = relationship("User", foreign_keys=[owner_user_id])
    parent = relationship("ScholarlyAsset", remote_side=[id], backref="children")
    contributors = relationship("ScholarlyAssetContributor", back_populates="asset", cascade="all, delete-orphan")
    files = relationship("ScholarlyAssetFile", back_populates="asset", cascade="all, delete-orphan")


class ScholarlyAssetContributor(Base):
    __tablename__ = "core_scholarly_asset_contributors"

    id = Column(String, primary_key=True, index=True)
    asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    external_name = Column(String, nullable=True)
    orcid = Column(String, nullable=True)
    author_order = Column(Integer, default=1)
    is_corresponding_author = Column(Boolean, default=False)
    contribution_roles_json = Column(JSON, nullable=True)
    affiliation_text = Column(String, nullable=True)
    contribution_percentage = Column(Float, nullable=True)
    verified_status = Column(String, default="UNVERIFIED")

    asset = relationship("ScholarlyAsset", back_populates="contributors")
    user = relationship("User")


class ScholarlyAssetFile(Base):
    __tablename__ = "core_scholarly_asset_files"

    id = Column(String, primary_key=True, index=True)
    asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="CASCADE"), nullable=False)
    file_role = Column(String, nullable=False)
    version = Column(Integer, default=1)
    is_primary = Column(Boolean, default=False)
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)

    asset = relationship("ScholarlyAsset", back_populates="files")
    uploaded_file = relationship("UploadedFile")


class PromotionAssetSelection(Base):
    __tablename__ = "core_promotion_asset_selections"

    id = Column(String, primary_key=True, index=True)
    promotion_application_id = Column(String, nullable=False)
    scholarly_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False)
    eligibility_status = Column(String, default="PENDING")
    rule_set_id = Column(String, nullable=True)
    calculated_points = Column(Float, default=0.0)
    evidence_status = Column(String, default="PENDING")
    notes = Column(String, nullable=True)

    asset = relationship("ScholarlyAsset")


class DataProvenance(Base):
    __tablename__ = "core_data_provenances"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_module = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    imported_file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    imported_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    imported_at = Column(String, nullable=False)
    confidence_level = Column(String, default="HIGH")
    verification_status = Column(String, default="UNVERIFIED")
    metadata_json = Column(JSON, nullable=True)

    organization = relationship("Organization")
    imported_file = relationship("UploadedFile")
    importer = relationship("User")


