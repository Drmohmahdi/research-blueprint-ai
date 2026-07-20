export type VariableType = 'independent' | 'dependent' | 'mediator' | 'moderator' | 'control';
export type ScaleOfMeasurement = 'nominal' | 'ordinal' | 'interval' | 'ratio';

export interface ResearchVariable {
  id: string;
  nameAr: string;
  nameEn: string;
  type: VariableType;
  scale: ScaleOfMeasurement;
  descriptionAr?: string;
  descriptionEn?: string;
  maxValue?: number;
  minValue?: number;
}

export interface ResearchQuestion {
  id: string;
  textAr: string;
  textEn: string;
  associatedVariables: string[]; // variable IDs
}

export interface Hypothesis {
  id: string;
  questionId: string;
  textAr: string;
  textEn: string;
  type: 'null' | 'directional' | 'non-directional';
  independentVarId: string;
  dependentVarId: string;
  mediatorVarId?: string;
  moderatorVarId?: string;
}

export interface SampleSettings {
  populationSize?: number;
  marginOfError: number; // e.g., 0.05
  confidenceLevel: number; // e.g., 0.95
  expectedPower: number; // e.g., 0.80
  expectedEffectSize: number; // e.g., 0.5 (Cohen's d)
  expectedAttritionRate: number; // e.g., 0.15 (15%)
  groupsCount: number; // e.g., 2
}

export type MeasurementInstrumentKind = 'test' | 'scale' | 'observation' | 'rubric' | 'record' | 'other';
export type ReliabilityMethod = 'cronbach_alpha' | 'test_retest' | 'inter_rater' | 'internal_consistency' | 'not_applicable';

export interface MeasurementInstrument {
  variableId: string;
  name: string;
  kind: MeasurementInstrumentKind;
  itemCount?: number;
  scoringPlan: string;
  validityPlan: string;
  reliabilityMethod: ReliabilityMethod;
  reliabilityValue?: number;
}

export type StatisticalTest = 'ancova' | 'independent_t_test' | 'paired_t_test' | 'one_way_anova' | 'chi_square' | 'pearson_correlation' | 'linear_regression' | 'mann_whitney_u' | 'wilcoxon' | 'thematic_analysis' | 'other';
export type EffectSizeMetric = 'cohens_d' | 'eta_squared' | 'partial_eta_squared' | 'r' | 'odds_ratio' | 'none' | 'other';

export interface HypothesisAnalysisPlan {
  hypothesisId: string;
  statisticalTest: StatisticalTest;
  assumptionsPlan: string;
  effectSizeMetric: EffectSizeMetric;
  notes?: string;
}

export type EthicsApprovalStatus = 'not_required' | 'planned' | 'approved';

export interface EthicsFeasibilityPlan {
  approvalStatus: EthicsApprovalStatus;
  consentPlan: string;
  privacyPlan: string;
  riskMitigationPlan: string;
}

export interface PreRegistrationRevision {
  id: string;
  protocolVersion: number;
  hash: string;
  lockedAt: string;
  protocolSnapshot: Record<string, unknown>;
}

export type StudyDesignType =
  | 'experimental_rct'
  | 'quasi_experimental_pre_post'
  | 'quasi_experimental_post_only'
  | 'single_group_pre_post'
  | 'descriptive'
  | 'correlational'
  | 'predictive'
  | 'mixed_methods'
  | 'qualitative_case_study';

export interface ResearchProject {
  id: string;
  titleAr: string;
  titleEn: string;
  departmentAr: string;
  departmentEn: string;
  institutionAr: string;
  institutionEn: string;
  descriptionAr: string;
  descriptionEn: string;
  problemStatementAr: string;
  problemStatementEn: string;
  studyDesign: StudyDesignType;
  variables: ResearchVariable[];
  questions: ResearchQuestion[];
  hypotheses: Hypothesis[];
  sampleSettings: SampleSettings;
  preRegistrationHash?: string;
  preRegistrationLockedAt?: string;
  preRegistrationHistory?: PreRegistrationRevision[];
  version: number;
  activePathId?: string;
  completedSteps?: string[];
  intelligenceProfile?: any;
  // SaaS & Organization context
  organizationId?: string;
  // Extended research metadata
  objectives?: string;
  timeline?: string;
  ethics?: string;
  ethicsFeasibilityPlan?: EthicsFeasibilityPlan;
  measurementInstruments?: MeasurementInstrument[];
  hypothesisAnalysisPlans?: HypothesisAnalysisPlan[];
  // Intelligence metrics (flattened from profile)
  pooledEffectSize?: number;
  lastPredictedEffectSize?: number;
  lastSimulatedPower?: number;
  predictionQualityScore?: number;
}

export interface SimulationParameters {
  preTestMean: number;
  preTestSd: number;
  expectedGain: number; // Average gain amount or percentage
  gainType: 'fixed' | 'relative' | 'regression';
  betaPre?: number;
  betaTreatment?: number;
  betaEngagement?: number;
  errorSd: number;
  interventionEngagement: number; // 0.0 to 1.0
  attritionRate: number; // 0.0 to 1.0
  maxScore: number;
  seed: number;
  iterations: number;
}

export interface SimulationResult {
  observedActualData: {
    studentId: string;
    group: 'treatment' | 'control';
    preScore: number;
    postScore: number;
    engagement: number;
    retained: boolean;
  }[];
  summary: {
    treatmentSize: number;
    controlSize: number;
    preMeanTreatment: number;
    preMeanControl: number;
    postMeanTreatment: number;
    postMeanControl: number;
    meanGainTreatment: number;
    meanGainControl: number;
    cohensD: number;
    pValue: number;
    statisticalPower: number;
    attritionCount: number;
    successProbability: number;
  };
}
