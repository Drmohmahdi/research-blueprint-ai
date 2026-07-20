export interface ProfileIdentity {
  projectId: string;
  userId?: string;
  titleAr: string;
  titleEn: string;
  departmentAr?: string;
  departmentEn?: string;
  institutionAr?: string;
  institutionEn?: string;
}

export interface ProfilePurpose {
  problemStatementAr?: string;
  problemStatementEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  domain?: string;
  subDomain?: string;
  keywords?: string[];
}

export interface ProfileStage {
  activePathId?: string;
  currentStepId?: string;
  completedSteps: string[];
}

export interface ProfileDesign {
  studyDesign: string;
  hypothesesCount: number;
  questionsCount: number;
}

export interface ProfileVariable {
  id: string;
  nameAr: string;
  nameEn: string;
  type: 'independent' | 'dependent' | 'mediator' | 'moderator' | 'control';
  scale: 'nominal' | 'ordinal' | 'interval' | 'ratio';
  minValue?: number;
  maxValue?: number;
}

export interface ProfileSample {
  populationSize: number;
  marginOfError: number;
  confidenceLevel: number;
  expectedPower: number;
  expectedEffectSize: number;
  expectedAttritionRate: number;
  groupsCount: number;
}

export interface ProfileIntervention {
  expectedDurationDays?: number;
  fidelityThreshold?: number;
  interventionType?: string;
}

export interface ProfileEvidence {
  literatureStudiesCount: number;
  pooledEffectSize?: number;
  literaturePriorMean?: number;
  literaturePriorVariance?: number;
  evidenceQualityScore?: number;
}

export interface ProfileSimulation {
  simulationsCount: number;
  lastSimulatedPower?: number;
  lastSimulatedEffectSize?: number;
}

export interface ProfilePrediction {
  lastPredictedEffectSize?: number;
  predictionIntervalLower?: number;
  predictionIntervalUpper?: number;
  probabilityOfSignificance?: number;
  expectedPowerForecast?: number;
  expectedAttritionForecast?: number;
  predictionQualityScore?: number;
}

export interface ProfileExecution {
  actualRecruitment?: number;
  currentAttritionRate?: number;
  fidelityScore?: number;
  completionRate?: number;
  protocolDeviationsCount?: number;
}

export interface ProfileObserved {
  observedEffectSize?: number;
  observedTreatmentMean?: number;
  observedControlMean?: number;
  observedAttritionRate?: number;
  isWithinPredictionInterval?: boolean;
}

export interface ProfilePublication {
  readinessScore?: number;
  methodologicalRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  deskRejectionRiskIndex?: number;
}

export interface ProfileQuality {
  dataQualityScore?: number;
  missingDataPercentage?: number;
  outliersDetectedCount?: number;
  predictionEligibilityStatus?: 'ELIGIBLE' | 'INELIGIBLE';
}

export interface ProfileProvenance {
  source: 'LOCAL_STORAGE' | 'API_SERVER' | 'HYBRID_CACHE';
  generatedAt: string;
  generatedBy?: string;
  dataClassification: 'PUBLIC' | 'CONFIDENTIAL' | 'SENSITIVE';
  confidence: number;
  version: number;
}

export interface ResearchIntelligenceProfile {
  identity: ProfileIdentity;
  purpose: ProfilePurpose;
  stage: ProfileStage;
  design: ProfileDesign;
  variables: ProfileVariable[];
  sample: ProfileSample;
  intervention: ProfileIntervention;
  evidence: ProfileEvidence;
  simulation: ProfileSimulation;
  prediction: ProfilePrediction;
  execution: ProfileExecution;
  observed: ProfileObserved;
  publication: ProfilePublication;
  quality: ProfileQuality;
  provenance: ProfileProvenance;
}

// ---------------------------------------------------------
// Compatibility Mapper
// ---------------------------------------------------------
export function mapProjectToIntelligenceProfile(
  project: any,
  source: 'LOCAL_STORAGE' | 'API_SERVER' = 'LOCAL_STORAGE'
): ResearchIntelligenceProfile {
  if (!project) {
    throw new Error("Project object is required for mapping");
  }

  // Safe fallback configurations
  const sample = project.sampleSettings || {
    populationSize: 100,
    marginOfError: 0.05,
    confidenceLevel: 0.95,
    expectedPower: 0.80,
    expectedEffectSize: 0.5,
    expectedAttritionRate: 0.15,
    groupsCount: 2
  };

  const variablesMapped: ProfileVariable[] = (project.variables || []).map((v: any) => ({
    id: v.id,
    nameAr: v.nameAr || '',
    nameEn: v.nameEn || '',
    type: v.type || 'independent',
    scale: v.scale || 'nominal',
    minValue: v.minValue,
    maxValue: v.maxValue
  }));

  // Build the intelligence profile structure
  const profile: ResearchIntelligenceProfile = {
    identity: {
      projectId: project.id,
      titleAr: project.titleAr || '',
      titleEn: project.titleEn || '',
      departmentAr: project.departmentAr,
      departmentEn: project.departmentEn,
      institutionAr: project.institutionAr,
      institutionEn: project.institutionEn
    },
    purpose: {
      problemStatementAr: project.problemStatementAr,
      problemStatementEn: project.problemStatementEn,
      descriptionAr: project.descriptionAr,
      descriptionEn: project.descriptionEn,
      domain: project.domain || '',
      subDomain: project.subDomain || '',
      keywords: project.keywords || []
    },
    stage: {
      activePathId: project.activePathId || undefined,
      currentStepId: project.currentStepId || undefined,
      completedSteps: project.completedSteps || []
    },
    design: {
      studyDesign: project.studyDesign || 'quasi_experimental_pre_post',
      hypothesesCount: (project.hypotheses || []).length,
      questionsCount: (project.questions || []).length
    },
    variables: variablesMapped,
    sample: {
      populationSize: Number(sample.populationSize || 100),
      marginOfError: Number(sample.marginOfError || 0.05),
      confidenceLevel: Number(sample.confidenceLevel || 0.95),
      expectedPower: Number(sample.expectedPower || 0.80),
      expectedEffectSize: Number(sample.expectedEffectSize || 0.5),
      expectedAttritionRate: Number(sample.expectedAttritionRate || 0.15),
      groupsCount: Number(sample.groupsCount || 2)
    },
    intervention: {
      expectedDurationDays: project.expectedDurationDays || 30,
      fidelityThreshold: project.fidelityThreshold || 0.70,
      interventionType: project.interventionType || 'educational'
    },
    evidence: {
      literatureStudiesCount: project.literatureStudiesCount || 0,
      pooledEffectSize: project.pooledEffectSize,
      literaturePriorMean: project.literaturePriorMean,
      literaturePriorVariance: project.literaturePriorVariance,
      evidenceQualityScore: project.evidenceQualityScore
    },
    simulation: {
      simulationsCount: project.simulationsCount || 0,
      lastSimulatedPower: project.lastSimulatedPower,
      lastSimulatedEffectSize: project.lastSimulatedEffectSize
    },
    prediction: {
      lastPredictedEffectSize: project.lastPredictedEffectSize,
      predictionIntervalLower: project.predictionIntervalLower,
      predictionIntervalUpper: project.predictionIntervalUpper,
      probabilityOfSignificance: project.probabilityOfSignificance,
      expectedPowerForecast: project.expectedPowerForecast,
      expectedAttritionForecast: project.expectedAttritionForecast,
      predictionQualityScore: project.predictionQualityScore
    },
    execution: {
      actualRecruitment: project.actualRecruitment,
      currentAttritionRate: project.currentAttritionRate,
      fidelityScore: project.fidelityScore,
      completionRate: project.completionRate,
      protocolDeviationsCount: project.protocolDeviationsCount
    },
    observed: {
      observedEffectSize: project.observedEffectSize,
      observedTreatmentMean: project.observedTreatmentMean,
      observedControlMean: project.observedControlMean,
      observedAttritionRate: project.observedAttritionRate,
      isWithinPredictionInterval: project.isWithinPredictionInterval
    },
    publication: {
      readinessScore: project.readinessScore,
      methodologicalRiskLevel: project.methodologicalRiskLevel || 'LOW',
      deskRejectionRiskIndex: project.deskRejectionRiskIndex
    },
    quality: {
      dataQualityScore: project.dataQualityScore,
      missingDataPercentage: project.missingDataPercentage,
      outliersDetectedCount: project.outliersDetectedCount,
      predictionEligibilityStatus: project.predictionEligibilityStatus || 'ELIGIBLE'
    },
    provenance: {
      source,
      generatedAt: new Date().toISOString(),
      generatedBy: project.userId || 'system',
      dataClassification: 'CONFIDENTIAL',
      confidence: project.preRegistrationLockedAt ? 95 : 75,
      version: project.version || 1
    }
  };

  return profile;
}
