from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, Boolean, UniqueConstraint, Index, text
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
    search_text = Column(String, nullable=True)
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
    literature_studies = relationship("LiteratureStudy", back_populates="project", cascade="all, delete-orphan")
    prisma_flow = relationship("PrismaFlow", back_populates="project", uselist=False, cascade="all, delete-orphan")


class ResearchDataset(Base):
    __tablename__ = "research_datasets"
    __table_args__ = (Index("ix_dataset_org_project", "organization_id", "project_id"),)

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False, default="OTHER")
    sensitivity = Column(String, nullable=False, default="INTERNAL")
    status = Column(String, nullable=False, default="RAW")
    current_version_id = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (
        UniqueConstraint("dataset_id", "version_number", name="uq_dataset_version_number"),
        Index("ix_dataset_version_org", "organization_id", "dataset_id"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String, ForeignKey("research_datasets.id", ondelete="CASCADE"), nullable=False)
    source_version_id = Column(String, ForeignKey("dataset_versions.id", ondelete="SET NULL"), nullable=True)
    uploaded_file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    version_number = Column(String, nullable=False)
    kind = Column(String, nullable=False, default="RAW")
    fingerprint = Column(String, nullable=False)
    row_count = Column(Integer, nullable=False, default=0)
    column_count = Column(Integer, nullable=False, default=0)
    data_json = Column(JSON, nullable=False)
    change_summary = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)


class DatasetVariable(Base):
    __tablename__ = "dataset_variables"
    __table_args__ = (UniqueConstraint("dataset_id", "name", name="uq_dataset_variable_name"),)

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String, ForeignKey("research_datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    label_ar = Column(String, nullable=True)
    label_en = Column(String, nullable=True)
    description = Column(String, nullable=True)
    data_type = Column(String, nullable=False)
    measurement_level = Column(String, nullable=False, default="NOMINAL")
    role = Column(String, nullable=False, default="OTHER")
    allowed_values = Column(JSON, nullable=True)
    missing_codes = Column(JSON, nullable=True)
    sensitive = Column(Boolean, nullable=False, default=False)
    identifier = Column(Boolean, nullable=False, default=False)


class DatasetQualityIssue(Base):
    __tablename__ = "dataset_quality_issues"
    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String, ForeignKey("research_datasets.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(String, ForeignKey("dataset_versions.id", ondelete="CASCADE"), nullable=False)
    variable_name = Column(String, nullable=True)
    row_reference = Column(String, nullable=True)
    issue_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    status = Column(String, nullable=False, default="OPEN")
    details = Column(JSON, nullable=True)
    resolution = Column(String, nullable=True)
    created_at = Column(String, nullable=False)


class ResearchAnalysis(Base):
    __tablename__ = "research_analyses"
    __table_args__ = (Index("ix_analysis_org_project", "organization_id", "project_id"),)
    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(String, ForeignKey("research_datasets.id", ondelete="CASCADE"), nullable=False)
    dataset_version_id = Column(String, ForeignKey("dataset_versions.id", ondelete="RESTRICT"), nullable=False)
    research_question_id = Column(String, ForeignKey("research_questions.id", ondelete="SET NULL"), nullable=True)
    hypothesis_id = Column(String, ForeignKey("hypotheses.id", ondelete="SET NULL"), nullable=True)
    analysis_type = Column(String, nullable=False)
    configuration = Column(JSON, nullable=False)
    result = Column(JSON, nullable=False)
    engine_version = Column(String, nullable=False)
    status = Column(String, nullable=False, default="COMPLETED")
    approved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)


class ResearchLifecycle(Base):
    """Project-level orchestration state. Domain completion remains derived."""
    __tablename__ = "research_lifecycles"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_research_lifecycle_project"),
        Index("ix_lifecycle_org_project", "organization_id", "project_id"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    template_key = Column(String, nullable=False)
    template_version = Column(Integer, nullable=False, default=1)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class ResearchVariableMapping(Base):
    __tablename__ = "research_variable_mappings"
    __table_args__ = (
        UniqueConstraint("research_variable_id", "dataset_variable_id", name="uq_research_dataset_variable_mapping"),
        Index("ix_variable_mapping_org_project", "organization_id", "project_id"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    research_variable_id = Column(String, ForeignKey("research_variables.id", ondelete="CASCADE"), nullable=False)
    dataset_variable_id = Column(String, ForeignKey("dataset_variables.id", ondelete="CASCADE"), nullable=False)
    mapping_role = Column(String, nullable=False, default="MEASURE")
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)


class AcademicHandoff(Base):
    __tablename__ = "academic_handoffs"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_academic_handoff_idempotency"),
        Index("ix_handoff_org_project_status", "organization_id", "project_id", "status"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    handoff_type = Column(String, nullable=False)
    source_entity_type = Column(String, nullable=False)
    source_entity_id = Column(String, nullable=False)
    source_version = Column(String, nullable=True)
    source_fingerprint = Column(String, nullable=True)
    target_domain = Column(String, nullable=False)
    target_entity_type = Column(String, nullable=True)
    target_entity_id = Column(String, nullable=True)
    payload_json = Column(JSON, nullable=False)
    schema_version = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default="PENDING")
    idempotency_key = Column(String, nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)
    accepted_at = Column(String, nullable=True)
    stale_at = Column(String, nullable=True)


class AnalysisAssetDependency(Base):
    __tablename__ = "analysis_asset_dependencies"
    __table_args__ = (
        UniqueConstraint("analysis_id", "scholarly_asset_id", name="uq_analysis_asset_dependency"),
        Index("ix_analysis_asset_org_project", "organization_id", "project_id"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(String, ForeignKey("research_analyses.id", ondelete="RESTRICT"), nullable=False)
    scholarly_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False)
    analysis_engine_version = Column(String, nullable=False)
    dataset_version_id = Column(String, ForeignKey("dataset_versions.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String, nullable=False, default="CURRENT")
    created_at = Column(String, nullable=False)
    needs_review_at = Column(String, nullable=True)


class ResearchLineageEdge(Base):
    __tablename__ = "research_lineage_edges"
    __table_args__ = (
        UniqueConstraint("relationship_type", "source_entity_type", "source_entity_id", "target_entity_type", "target_entity_id", name="uq_research_lineage_edge"),
        Index("ix_lineage_org_project", "organization_id", "project_id"),
    )

    id = Column(String, primary_key=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False)
    source_entity_type = Column(String, nullable=False)
    source_entity_id = Column(String, nullable=False)
    source_version = Column(String, nullable=True)
    relationship_type = Column(String, nullable=False)
    target_entity_type = Column(String, nullable=False)
    target_entity_id = Column(String, nullable=False)
    target_version = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)



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
    code = Column(String, unique=True, index=True, nullable=False) # FREE, STARTER, PROFESSIONAL, INSTITUTIONAL (or legacy PERSONAL_FREE, RESEARCHER_PRO)
    name = Column(String, nullable=False)
    name_ar = Column(String, nullable=True)
    name_en = Column(String, nullable=True)
    description = Column(String, nullable=True)
    description_ar = Column(String, nullable=True)
    description_en = Column(String, nullable=True)
    billing_interval = Column(String, nullable=False, default="MONTHLY") # MONTHLY, YEARLY
    price = Column(Float, nullable=False, default=0.0) # Legacy float
    price_minor_units = Column(Integer, nullable=False, default=0) # Integer minor units (halalas)
    currency = Column(String, nullable=False, default="SAR")
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=True)
    trial_days = Column(Integer, default=0)
    limits_json = Column(JSON, nullable=False)
    features_json = Column(JSON, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)

    prices = relationship("CommercialPlanPrice", back_populates="plan", cascade="all, delete-orphan")
    entitlements = relationship("CommercialPlanEntitlement", back_populates="plan", cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_price_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE") # TRIALING, ACTIVE, PAST_DUE, PAUSED, CANCELLED, EXPIRED, SUSPENDED
    provider = Column(String, nullable=False, default="MOCK") # MOCK, NULL_ADAPTER, SANDBOX, MOYASAR, STRIPE
    provider_customer_id = Column(String, nullable=True)
    provider_subscription_id = Column(String, nullable=True)
    unit_amount_minor_units = Column(Integer, nullable=False, default=0)
    currency = Column(String, nullable=False, default="SAR")
    billing_interval = Column(String, nullable=False, default="MONTHLY")
    current_period_start = Column(String, nullable=False)
    current_period_end = Column(String, nullable=False)
    trial_ends_at = Column(String, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    cancelled_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)

    plan = relationship("Plan")
    organization = relationship("Organization")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(String, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_invoice_id = Column(String, nullable=True)
    invoice_number = Column(String, nullable=False, index=True)
    amount_subtotal = Column(Float, nullable=False, default=0.0)
    amount_tax = Column(Float, nullable=False, default=0.0)
    amount_total = Column(Float, nullable=False, default=0.0)
    amount_subtotal_minor_units = Column(Integer, nullable=False, default=0)
    tax_rate_basis_points = Column(Integer, nullable=False, default=1500) # 15% VAT default
    amount_tax_minor_units = Column(Integer, nullable=False, default=0)
    amount_total_minor_units = Column(Integer, nullable=False, default=0)
    currency = Column(String, nullable=False, default="SAR")
    status = Column(String, nullable=False, default="PAID") # DRAFT, ISSUED, PAID, VOID, UNCOLLECTIBLE
    issued_at = Column(String, nullable=False)
    due_at = Column(String, nullable=True)
    paid_at = Column(String, nullable=True)
    invoice_url = Column(String, nullable=True)
    pdf_asset_id = Column(String, nullable=True)
    seller_snapshot_json = Column(JSON, nullable=True)
    buyer_snapshot_json = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    subscription = relationship("Subscription")
    organization = relationship("Organization")
    lines = relationship("CommercialInvoiceLine", back_populates="invoice", cascade="all, delete-orphan")


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
    search_text = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    deleted_at = Column(String, nullable=True)


class StorageQuotaUsage(Base):
    """
    Atomic per-organization storage usage counter used for concurrency-safe
    storage quota enforcement (reserve -> upload -> commit usage).
    One row per organization; updated atomically with a conditional UPDATE so
    concurrent uploads cannot exceed the plan's storage limit.
    """
    __tablename__ = "storage_quota_usage"

    organization_id = Column(String, primary_key=True, index=True)
    used_bytes = Column(Integer, nullable=False, default=0)
    updated_at = Column(String, nullable=True)


class PlatformSetting(Base):
    """
    Persistent platform-wide settings and feature flags managed from the Admin
    Center. Keyed by setting name; values are typed (string, int, bool, json).
    Global admins only.
    """
    __tablename__ = "platform_settings"

    key = Column(String, primary_key=True, index=True)
    value_type = Column(String, nullable=False, default="string")  # string, int, bool, json
    value_json = Column(JSON, nullable=True)
    description_ar = Column(String, nullable=True)
    description_en = Column(String, nullable=True)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(String, nullable=False, index=True)


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
    search_text = Column(String, nullable=True)
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
    search_text = Column(String, nullable=True)
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


class PromotionPolicy(Base):
    __tablename__ = "promotion_policies"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    description_ar = Column(String, nullable=True)
    description_en = Column(String, nullable=True)
    target_rank = Column(String, nullable=False, index=True)
    version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False) # DRAFT, ACTIVE, RETIRED
    is_default = Column(Boolean, default=False)
    rules_json = Column(JSON, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    organization = relationship("Organization")
    creator = relationship("User")
    criteria = relationship("PromotionCriterion", back_populates="policy", cascade="all, delete-orphan")
    applications = relationship("PromotionApplication", back_populates="policy")


class PromotionCriterion(Base):
    __tablename__ = "promotion_criteria"

    id = Column(String, primary_key=True, index=True)
    policy_id = Column(String, ForeignKey("promotion_policies.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String, nullable=False)
    title_ar = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    criterion_type = Column(String, default="RESEARCH_OUTPUT", nullable=False)
    required_points = Column(Float, default=0.0)
    min_asset_count = Column(Integer, default=0)
    rule_definition_json = Column(JSON, nullable=False)
    weight = Column(Float, default=1.0)
    is_mandatory = Column(Boolean, default=True)
    sort_order = Column(Integer, default=1)
    created_at = Column(String, nullable=False)

    policy = relationship("PromotionPolicy", back_populates="criteria")
    organization = relationship("Organization")


class PromotionApplication(Base):
    __tablename__ = "promotion_applications"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String, ForeignKey("promotion_policies.id", ondelete="RESTRICT"), nullable=False, index=True)
    policy_version = Column(Integer, default=1, nullable=False)
    current_rank = Column(String, nullable=True)
    target_rank = Column(String, nullable=False)
    status = Column(String, default="DRAFT", nullable=False) # DRAFT, READY_FOR_REVIEW, SUBMITTED, UNDER_REVIEW, RETURNED_FOR_CHANGES, COMPLETED
    readiness_percentage = Column(Integer, default=0)
    total_calculated_points = Column(Float, default=0.0)
    evaluation_summary_json = Column(JSON, nullable=True)
    evaluation_fingerprint = Column(String, nullable=True)
    search_text = Column(String, nullable=True)
    human_review_decision = Column(String, nullable=True) # ELIGIBLE_RECOMMENDED, INELIGIBLE_DEFICIENT, REQUIRES_FURTHER_DOCS, PENDING_COMMITTEE
    human_review_notes = Column(String, nullable=True)
    reviewer_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(String, nullable=True)
    submitted_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    organization = relationship("Organization")
    applicant = relationship("User", foreign_keys=[user_id])
    policy = relationship("PromotionPolicy", back_populates="applications")
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])
    evidence_selections = relationship("PromotionAssetSelection", back_populates="application", cascade="all, delete-orphan")
    snapshots = relationship("PromotionEvaluationSnapshot", back_populates="application", cascade="all, delete-orphan")


class PromotionAssetSelection(Base):
    __tablename__ = "core_promotion_asset_selections"

    id = Column(String, primary_key=True, index=True)
    promotion_application_id = Column(String, ForeignKey("promotion_applications.id", ondelete="CASCADE"), nullable=False, index=True)
    scholarly_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(String, ForeignKey("promotion_criteria.id", ondelete="SET NULL"), nullable=True)
    eligibility_status = Column(String, default="PENDING")
    rule_set_id = Column(String, nullable=True)
    calculated_points = Column(Float, default=0.0)
    evidence_status = Column(String, default="PENDING")
    evidence_snapshot_json = Column(JSON, nullable=True)
    verification_status = Column(String, default="UNVERIFIED")
    notes = Column(String, nullable=True)
    created_at = Column(String, nullable=True)

    application = relationship("PromotionApplication", back_populates="evidence_selections")
    asset = relationship("ScholarlyAsset")
    criterion = relationship("PromotionCriterion")


class PromotionEvaluationSnapshot(Base):
    __tablename__ = "promotion_evaluation_snapshots"

    id = Column(String, primary_key=True, index=True)
    application_id = Column(String, ForeignKey("promotion_applications.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String, ForeignKey("promotion_policies.id", ondelete="SET NULL"), nullable=True)
    policy_version = Column(Integer, nullable=False)
    readiness_percentage = Column(Integer, nullable=False)
    total_points = Column(Float, nullable=False)
    criteria_results_json = Column(JSON, nullable=False)
    evaluation_fingerprint = Column(String, nullable=False)
    evaluated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    evaluated_at = Column(String, nullable=False)

    application = relationship("PromotionApplication", back_populates="snapshots")
    policy = relationship("PromotionPolicy")
    evaluator = relationship("User")



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


class LiteratureStudy(Base):
    __tablename__ = "project_literature_studies"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    author = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    sampleSize = Column(Integer, nullable=False)
    effectSize = Column(Float, nullable=False) # Cohen's d
    ciLower = Column(Float, nullable=False)
    ciUpper = Column(Float, nullable=False)
    source = Column(String, default="manual")
    doi = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    search_text = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)
    updatedAt = Column(String, nullable=False)

    project = relationship("ResearchProject", back_populates="literature_studies")
    organization = relationship("Organization")


class PrismaFlow(Base):
    __tablename__ = "project_prisma_flows"

    id = Column(String, primary_key=True, index=True)
    projectId = Column(String, ForeignKey("research_projects.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    organizationId = Column(String, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    identified = Column(Integer, default=0, nullable=False)
    duplicates = Column(Integer, default=0, nullable=False)
    excludedScreening = Column(Integer, default=0, nullable=False)
    excludedEligibility = Column(Integer, default=0, nullable=False)
    source = Column(String, default="manual")
    notes = Column(String, nullable=True)
    createdAt = Column(String, nullable=False)
    updatedAt = Column(String, nullable=False)

    project = relationship("ResearchProject", back_populates="prisma_flow")
    organization = relationship("Organization")


# ── Peer Review Domain Models ──────────────────────────────────────────────────

class PeerReviewCase(Base):
    __tablename__ = "peer_review_cases"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("research_projects.id", ondelete="SET NULL"), nullable=True, index=True)
    scholarly_asset_id = Column(String, ForeignKey("core_scholarly_assets.id", ondelete="SET NULL"), nullable=True, index=True)
    title_ar = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    abstract_ar = Column(String, nullable=True)
    abstract_en = Column(String, nullable=True)
    discipline = Column(String, nullable=True)
    case_type = Column(String, default="MANUSCRIPT", nullable=False)  # MANUSCRIPT, PROPOSAL, STUDY_DESIGN, PROMOTION_DOSSIER
    blind_type = Column(String, default="DOUBLE_BLIND", nullable=False)  # SINGLE_BLIND, DOUBLE_BLIND, OPEN
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, IN_REVIEW, REVISION_REQUESTED, DECIDED, WITHDRAWN
    current_round_number = Column(Integer, default=1, nullable=False)
    search_text = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    organization = relationship("Organization")
    owner = relationship("User", foreign_keys=[owner_user_id])
    project = relationship("ResearchProject")
    scholarly_asset = relationship("ScholarlyAsset")
    rounds = relationship("PeerReviewRound", back_populates="case", cascade="all, delete-orphan")
    revisions = relationship("ManuscriptRevision", back_populates="case", cascade="all, delete-orphan")


class PeerReviewRound(Base):
    __tablename__ = "peer_review_rounds"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("peer_review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    manuscript_version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE, COMPLETED, CANCELLED
    manuscript_snapshot_json = Column(JSON, nullable=True)
    rubric_id = Column(String, ForeignKey("review_rubrics.id", ondelete="SET NULL"), nullable=True)
    rubric_snapshot_json = Column(JSON, nullable=True)
    decision = Column(String, default="PENDING", nullable=False)  # PENDING, ACCEPTED, REVISION_REQUIRED, REJECTED
    decision_notes = Column(String, nullable=True)
    decision_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decision_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

    case = relationship("PeerReviewCase", back_populates="rounds")
    rubric = relationship("ReviewRubric")
    decision_maker = relationship("User", foreign_keys=[decision_by_user_id])
    assignments = relationship("ReviewerAssignment", back_populates="round", cascade="all, delete-orphan")


class ReviewRubric(Base):
    __tablename__ = "review_rubrics"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name_ar = Column(String, nullable=False)
    name_en = Column(String, nullable=False)
    rubric_type = Column(String, default="GENERAL_MANUSCRIPT", nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_default = Column(Boolean, default=False)
    status = Column(String, default="ACTIVE", nullable=False)  # ACTIVE, ARCHIVED
    created_at = Column(String, nullable=False)

    organization = relationship("Organization")
    criteria = relationship("ReviewCriterion", back_populates="rubric", cascade="all, delete-orphan")


class ReviewCriterion(Base):
    __tablename__ = "review_criteria"

    id = Column(String, primary_key=True, index=True)
    rubric_id = Column(String, ForeignKey("review_rubrics.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String, nullable=False)
    title_ar = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    desc_ar = Column(String, nullable=True)
    desc_en = Column(String, nullable=True)
    response_type = Column(String, default="SCORE", nullable=False)  # SCORE, YES_NO, TEXT, CHOICE
    weight = Column(Float, default=1.0, nullable=False)
    is_mandatory = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=1, nullable=False)
    options_json = Column(JSON, nullable=True)
    created_at = Column(String, nullable=False)

    rubric = relationship("ReviewRubric", back_populates="criteria")


class ReviewerAssignment(Base):
    __tablename__ = "reviewer_assignments"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("peer_review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(String, ForeignKey("peer_review_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_type = Column(String, default="INTERNAL_REVIEWER", nullable=False)  # INTERNAL_REVIEWER, EXTERNAL_REVIEWER
    reviewer_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    external_email = Column(String, nullable=True, index=True)
    external_name = Column(String, nullable=True)
    status = Column(String, default="INVITED", nullable=False)  # INVITED, ACCEPTED, DECLINED, IN_PROGRESS, SUBMITTED, EXPIRED, REVOKED
    conflict_status = Column(String, default="NO_CONFLICT", nullable=False)  # NO_CONFLICT, POTENTIAL_CONFLICT, CONFLICT_DECLARED
    conflict_notes = Column(String, nullable=True)
    decline_reason = Column(String, nullable=True)
    due_at = Column(String, nullable=True)
    invited_at = Column(String, nullable=False)
    accepted_at = Column(String, nullable=True)
    submitted_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

    round = relationship("PeerReviewRound", back_populates="assignments")
    reviewer_user = relationship("User", foreign_keys=[reviewer_user_id])
    tokens = relationship("ExternalReviewerToken", back_populates="assignment", cascade="all, delete-orphan")
    submission = relationship("ReviewSubmission", back_populates="assignment", uselist=False, cascade="all, delete-orphan")


class ExternalReviewerToken(Base):
    __tablename__ = "external_reviewer_tokens"

    id = Column(String, primary_key=True, index=True)
    assignment_id = Column(String, ForeignKey("reviewer_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(String, nullable=False)
    used_at = Column(String, nullable=True)
    revoked_at = Column(String, nullable=True)
    revoked_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)

    assignment = relationship("ReviewerAssignment", back_populates="tokens")
    revoker = relationship("User")


class ReviewSubmission(Base):
    __tablename__ = "review_submissions"

    id = Column(String, primary_key=True, index=True)
    assignment_id = Column(String, ForeignKey("reviewer_assignments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    round_id = Column(String, ForeignKey("peer_review_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(String, ForeignKey("peer_review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="DRAFT", nullable=False)  # DRAFT, SUBMITTED
    recommendation = Column(String, default="MINOR_REVISION", nullable=False)  # ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT
    summary_evaluation_ar = Column(String, nullable=True)
    summary_evaluation_en = Column(String, nullable=True)
    total_weighted_score = Column(Float, default=0.0, nullable=False)
    is_confidential_to_editor = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    assignment = relationship("ReviewerAssignment", back_populates="submission")
    responses = relationship("ReviewCriterionResponse", back_populates="submission", cascade="all, delete-orphan")
    comments = relationship("ReviewComment", back_populates="submission", cascade="all, delete-orphan")


class ReviewCriterionResponse(Base):
    __tablename__ = "review_criterion_responses"

    id = Column(String, primary_key=True, index=True)
    submission_id = Column(String, ForeignKey("review_submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(String, ForeignKey("review_criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    score_value = Column(Float, nullable=True)
    text_value = Column(String, nullable=True)
    choice_value = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

    submission = relationship("ReviewSubmission", back_populates="responses")
    criterion = relationship("ReviewCriterion")


class ReviewComment(Base):
    __tablename__ = "review_comments"

    id = Column(String, primary_key=True, index=True)
    submission_id = Column(String, ForeignKey("review_submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id = Column(String, ForeignKey("peer_review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(String, ForeignKey("peer_review_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    section_key = Column(String, nullable=True)
    comment_type = Column(String, default="AUTHOR_VISIBLE", nullable=False)  # AUTHOR_VISIBLE, CONFIDENTIAL_TO_EDITOR
    comment_text = Column(String, nullable=False)
    author_response_text = Column(String, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False)

    submission = relationship("ReviewSubmission", back_populates="comments")


class ManuscriptRevision(Base):
    __tablename__ = "manuscript_revisions"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("peer_review_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(String, ForeignKey("peer_review_rounds.id", ondelete="SET NULL"), nullable=True, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    title_ar = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    abstract_ar = Column(String, nullable=True)
    abstract_en = Column(String, nullable=True)
    response_to_reviewers = Column(String, nullable=True)
    file_id = Column(String, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(String, nullable=False)

    case = relationship("PeerReviewCase", back_populates="revisions")
    uploader = relationship("User")
    file = relationship("UploadedFile")


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    aggregate_type = Column(String, nullable=False, index=True)
    aggregate_id = Column(String, nullable=False, index=True)
    actor_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    payload_json = Column(JSON, default=dict, nullable=False)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="PENDING", nullable=False, index=True)  # PENDING, PROCESSING, PROCESSED, FAILED
    attempt_count = Column(Integer, default=0, nullable=False)
    next_attempt_at = Column(String, nullable=True)
    occurred_at = Column(String, nullable=False)
    processed_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

    organization = relationship("Organization")
    actor = relationship("User")
    notifications = relationship("Notification", back_populates="workflow_event", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_event_id = Column(String, ForeignKey("workflow_events.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String, nullable=False, index=True)  # PROMOTION, PEER_REVIEW, RESEARCH_WORKFLOW, SYSTEM
    title_ar = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    message_ar = Column(String, nullable=False)
    message_en = Column(String, nullable=False)
    target_type = Column(String, nullable=True)  # PROMOTION_APPLICATION, PEER_REVIEW_CASE, RESEARCH_PROJECT
    target_id = Column(String, nullable=True)
    read_at = Column(String, nullable=True, index=True)
    created_at = Column(String, nullable=False, index=True)

    organization = relationship("Organization")
    recipient = relationship("User")
    workflow_event = relationship("WorkflowEvent", back_populates="notifications")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", "category", name="uq_user_org_category_pref"),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String, nullable=False, index=True)  # PROMOTION, PEER_REVIEW, RESEARCH_WORKFLOW, SYSTEM
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(String, nullable=False)

    user = relationship("User")
    organization = relationship("Organization")


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_id = Column(String, ForeignKey("notifications.id", ondelete="SET NULL"), nullable=True, index=True)
    workflow_event_id = Column(String, ForeignKey("workflow_events.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String, nullable=False)  # IN_APP, EMAIL
    recipient_address = Column(String, nullable=True)
    status = Column(String, default="DELIVERED", nullable=False, index=True)  # DELIVERED, NOT_CONFIGURED, FAILED, SKIPPED_PREFERENCE
    attempt_count = Column(Integer, default=1, nullable=False)
    last_attempt_at = Column(String, nullable=True)
    failure_code = Column(String, nullable=True)
    created_at = Column(String, nullable=False)

    organization = relationship("Organization")
    notification = relationship("Notification")
    workflow_event = relationship("WorkflowEvent")


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 07 — COMMERCIAL SAAS BILLING, PRICING & PAYMENT MODELS
# ─────────────────────────────────────────────────────────────────────────────

class CommercialPlanPrice(Base):
    __tablename__ = "commercial_plan_prices"

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    billing_interval = Column(String, nullable=False, default="MONTHLY")  # MONTHLY, YEARLY
    price_minor_units = Column(Integer, nullable=False, default=0)  # Integer minor units (Halalas / cents)
    currency = Column(String, nullable=False, default="SAR")
    is_active = Column(Boolean, nullable=False, default=True)
    provider_price_ref = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=True)

    plan = relationship("Plan", back_populates="prices")


class CommercialPlanEntitlement(Base):
    __tablename__ = "commercial_plan_entitlements"
    __table_args__ = (
        UniqueConstraint("plan_id", "feature_key", name="uq_plan_feature_entitlement"),
    )

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    feature_key = Column(String, nullable=False, index=True)  # ADVANCED_REPORTING, PEER_REVIEW, PROMOTION_ENGINE, AI_ASSISTANCE, EXPORT_PDF, EXPORT_DOCX, EXTERNAL_REVIEWERS, MAX_PROJECTS, MAX_MEMBERS, MAX_REPORTS_MONTHLY, MAX_STORAGE_MB
    is_enabled = Column(Boolean, nullable=False, default=True)
    limit_value = Column(Integer, nullable=True, default=None)  # integer limit or null/-1 for unlimited
    created_at = Column(String, nullable=False)

    plan = relationship("Plan", back_populates="entitlements")


class CommercialInvoiceLine(Base):
    __tablename__ = "commercial_invoice_lines"

    id = Column(String, primary_key=True, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description_ar = Column(String, nullable=False)
    description_en = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_amount_minor_units = Column(Integer, nullable=False, default=0)
    line_total_minor_units = Column(Integer, nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="lines")


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True)
    provider = Column(String, nullable=False, default="NULL_ADAPTER")  # NULL_ADAPTER, SANDBOX, MOYASAR, STRIPE
    provider_transaction_ref = Column(String, nullable=True, unique=True, index=True)
    amount_minor_units = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="SAR")
    status = Column(String, nullable=False, default="PENDING", index=True)  # PENDING, AUTHORIZED, PAID, FAILED, REFUNDED
    failure_code = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    confirmed_at = Column(String, nullable=True)

    organization = relationship("Organization")
    invoice = relationship("Invoice")


class PaymentWebhookEvent(Base):
    __tablename__ = "payment_webhook_events"

    id = Column(String, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    provider_event_id = Column(String, nullable=False, unique=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    received_at = Column(String, nullable=False)
    processed_at = Column(String, nullable=True)
    status = Column(String, nullable=False, default="RECEIVED", index=True)  # RECEIVED, PROCESSED, IGNORED, FAILED
    signature_valid = Column(Boolean, nullable=False, default=True)
    error_details = Column(String, nullable=True)
    payload_summary_json = Column(JSON, nullable=True)


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 10 — GOVERNED ACADEMIC AI LAYER
# ─────────────────────────────────────────────────────────────────────────────

class AIRun(Base):
    """
    AI usage / audit record. Stores safe operational metadata only — never raw
    prompts, full source content, full model responses, or secrets.
    """
    __tablename__ = "ai_runs"
    __table_args__ = (
        Index(
            "uq_ai_runs_org_idempotency",
            "organization_id",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
            sqlite_where=text("idempotency_key IS NOT NULL"),
        ),
    )

    id = Column(String, primary_key=True, index=True)
    organization_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    use_case = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=True)
    prompt_version = Column(Integer, nullable=True)
    input_token_count = Column(Integer, nullable=True)
    output_token_count = Column(Integer, nullable=True)
    estimated_tokens = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="COMPLETED")  # COMPLETED, FAILED, RATE_LIMITED, TIMEOUT, ENTITLEMENT_DENIED
    latency_ms = Column(Integer, nullable=True)
    error_code = Column(String, nullable=True)
    retrieval_count = Column(Integer, nullable=True)
    idempotency_key = Column(String, nullable=True, index=True)
    created_at = Column(String, nullable=False, index=True)
