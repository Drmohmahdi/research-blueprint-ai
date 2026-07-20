export interface ResearchTool {
  id: string;
  currentView: string;
  titleKey: string;
  descriptionKey: string;
  iconName: string;
  primaryPath: string;
  availableInPaths: string[];
  requiredInputs: string[];
  optionalInputs: string[];
  producedOutputs: string[];
  prerequisites: string[];
  nextRecommendedTools: string[];
  dataClassification: 'PUBLIC' | 'CONFIDENTIAL' | 'SENSITIVE';
  status: 'STABLE' | 'BETA';
  featureFlag?: string;
  roleRestrictions?: string[];
}

export const RESEARCH_TOOLS_REGISTRY: ResearchTool[] = [
  {
    id: 'dashboard',
    currentView: 'dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'dashboard_desc',
    iconName: 'LayoutDashboard',
    primaryPath: 'GENERAL',
    availableInPaths: ['NEW_STUDY_DESIGN', 'FUTURE_OUTCOME_FORECAST', 'ACTIVE_FIELD_STUDY', 'COMPLETED_STUDY_ANALYSIS'],
    requiredInputs: [],
    optionalInputs: [],
    producedOutputs: [],
    prerequisites: [],
    nextRecommendedTools: ['wizard'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'wizard',
    currentView: 'wizard',
    titleKey: 'wizard',
    descriptionKey: 'wizard_desc',
    iconName: 'FolderGit2',
    primaryPath: 'NEW_STUDY_DESIGN',
    availableInPaths: ['NEW_STUDY_DESIGN', 'FUTURE_OUTCOME_FORECAST'],
    requiredInputs: [],
    optionalInputs: ['titleAr', 'titleEn'],
    producedOutputs: ['projectId', 'variables', 'hypotheses', 'sampleSettings'],
    prerequisites: [],
    nextRecommendedTools: ['analyzer', 'modelBuilder'],
    dataClassification: 'CONFIDENTIAL',
    status: 'STABLE'
  },
  {
    id: 'analyzer',
    currentView: 'analyzer',
    titleKey: 'analyzer',
    descriptionKey: 'analyzer_desc',
    iconName: 'Sparkles',
    primaryPath: 'NEW_STUDY_DESIGN',
    availableInPaths: ['NEW_STUDY_DESIGN', 'SEMINAR_PROPOSAL_REVIEW'],
    requiredInputs: ['titleAr'],
    optionalInputs: ['titleEn'],
    producedOutputs: ['domain', 'subDomain', 'variables', 'population', 'context', 'methodSignal', 'publicationKeywords'],
    prerequisites: ['wizard'],
    nextRecommendedTools: ['modelBuilder'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'consistency',
    currentView: 'consistency',
    titleKey: 'consistency',
    descriptionKey: 'consistency_desc',
    iconName: 'CheckSquare',
    primaryPath: 'SEMINAR_PROPOSAL_REVIEW',
    availableInPaths: ['NEW_STUDY_DESIGN', 'SEMINAR_PROPOSAL_REVIEW'],
    requiredInputs: ['variables', 'hypotheses'],
    optionalInputs: ['questions'],
    producedOutputs: ['consistencyScore', 'methodologyFeedback'],
    prerequisites: ['wizard', 'modelBuilder'],
    nextRecommendedTools: ['sampleCalc'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'modelBuilder',
    currentView: 'modelBuilder',
    titleKey: 'modelBuilder',
    descriptionKey: 'modelBuilder_desc',
    iconName: 'GitFork',
    primaryPath: 'NEW_STUDY_DESIGN',
    availableInPaths: ['NEW_STUDY_DESIGN', 'SEMINAR_PROPOSAL_REVIEW'],
    requiredInputs: ['variables'],
    optionalInputs: ['hypotheses'],
    producedOutputs: ['conceptualRelations', 'mediationRelations', 'moderationRelations'],
    prerequisites: ['wizard'],
    nextRecommendedTools: ['consistency'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'sampleCalc',
    currentView: 'sampleCalc',
    titleKey: 'sampleCalc',
    descriptionKey: 'sampleCalc_desc',
    iconName: 'Calculator',
    primaryPath: 'NEW_STUDY_DESIGN',
    availableInPaths: ['NEW_STUDY_DESIGN', 'FUTURE_OUTCOME_FORECAST'],
    requiredInputs: ['sampleSettings'],
    optionalInputs: ['expectedEffectSize'],
    producedOutputs: ['minimumSample', 'recruitmentTarget', 'sensitivityTable'],
    prerequisites: ['wizard'],
    nextRecommendedTools: ['simulation'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'simulation',
    currentView: 'simulation',
    titleKey: 'simulation',
    descriptionKey: 'simulation_desc',
    iconName: 'PlayCircle',
    primaryPath: 'FUTURE_OUTCOME_FORECAST',
    availableInPaths: ['NEW_STUDY_DESIGN', 'FUTURE_OUTCOME_FORECAST'],
    requiredInputs: ['sampleSettings', 'variables'],
    optionalInputs: ['effectAssumptions'],
    producedOutputs: ['simulatedScenarios', 'simulatedPower', 'simulatedEffectDistribution'],
    prerequisites: ['sampleCalc'],
    nextRecommendedTools: ['outcomePredictor'],
    dataClassification: 'SENSITIVE',
    status: 'STABLE'
  },
  {
    id: 'dataQuality',
    currentView: 'dataQuality',
    titleKey: 'dataQuality',
    descriptionKey: 'dataQuality_desc',
    iconName: 'Database',
    primaryPath: 'COMPLETED_STUDY_ANALYSIS',
    availableInPaths: ['ACTIVE_FIELD_STUDY', 'COMPLETED_STUDY_ANALYSIS'],
    requiredInputs: [],
    optionalInputs: [],
    producedOutputs: ['dataQualityScore', 'missingness', 'outliers', 'predictionEligibility'],
    prerequisites: ['fidelity'],
    nextRecommendedTools: ['outcomePredictor'],
    dataClassification: 'SENSITIVE',
    status: 'STABLE'
  },
  {
    id: 'preReg',
    currentView: 'preReg',
    titleKey: 'preReg',
    descriptionKey: 'preReg_desc',
    iconName: 'FileLock2',
    primaryPath: 'NEW_STUDY_DESIGN',
    availableInPaths: ['NEW_STUDY_DESIGN', 'SEMINAR_PROPOSAL_REVIEW'],
    requiredInputs: ['variables', 'hypotheses', 'sampleSettings'],
    optionalInputs: [],
    producedOutputs: ['preRegistrationHash', 'preRegistrationLockedAt'],
    prerequisites: ['consistency'],
    nextRecommendedTools: ['fidelity'],
    dataClassification: 'CONFIDENTIAL',
    status: 'STABLE'
  },
  {
    id: 'fidelity',
    currentView: 'fidelity',
    titleKey: 'fidelity',
    descriptionKey: 'fidelity_desc',
    iconName: 'Activity',
    primaryPath: 'ACTIVE_FIELD_STUDY',
    availableInPaths: ['ACTIVE_FIELD_STUDY'],
    requiredInputs: ['sampleSettings'],
    optionalInputs: [],
    producedOutputs: ['actualRecruitment', 'currentAttrition', 'fidelity', 'completion', 'protocolDeviations'],
    prerequisites: ['preReg'],
    nextRecommendedTools: ['dataQuality', 'outcomePredictor'],
    dataClassification: 'SENSITIVE',
    status: 'STABLE'
  },
  {
    id: 'litSynthesizer',
    currentView: 'litSynthesizer',
    titleKey: 'litSynthesizer',
    descriptionKey: 'litSynthesizer_desc',
    iconName: 'BookOpen',
    primaryPath: 'SYSTEMATIC_REVIEW',
    availableInPaths: ['SYSTEMATIC_REVIEW', 'NEW_STUDY_DESIGN', 'FUTURE_OUTCOME_FORECAST'],
    requiredInputs: [],
    optionalInputs: [],
    producedOutputs: ['pooledEffect', 'heterogeneity', 'literaturePrior', 'evidenceQuality'],
    prerequisites: [],
    nextRecommendedTools: ['outcomePredictor'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'reviewSim',
    currentView: 'reviewSim',
    titleKey: 'reviewSim',
    descriptionKey: 'reviewSim_desc',
    iconName: 'UserCheck',
    primaryPath: 'MANUSCRIPT_PUBLICATION',
    availableInPaths: ['MANUSCRIPT_PUBLICATION', 'THESIS_DEFENSE_PREPARATION'],
    requiredInputs: ['variables', 'hypotheses'],
    optionalInputs: ['simulatedScenarios'],
    producedOutputs: ['publicationReadiness', 'methodologicalRisk', 'reportingGaps', 'deskRejectionRisks'],
    prerequisites: ['dataQuality'],
    nextRecommendedTools: [],
    dataClassification: 'CONFIDENTIAL',
    status: 'STABLE'
  },
  {
    id: 'prisma',
    currentView: 'prisma',
    titleKey: 'prisma',
    descriptionKey: 'prisma_desc',
    iconName: 'BookOpen',
    primaryPath: 'SYSTEMATIC_REVIEW',
    availableInPaths: ['SYSTEMATIC_REVIEW'],
    requiredInputs: [],
    optionalInputs: [],
    producedOutputs: ['prismaFlowchart'],
    prerequisites: [],
    nextRecommendedTools: ['litSynthesizer'],
    dataClassification: 'PUBLIC',
    status: 'STABLE'
  },
  {
    id: 'qualitative',
    currentView: 'qualitative',
    titleKey: 'qualitative',
    descriptionKey: 'qualitative_desc',
    iconName: 'Sparkles',
    primaryPath: 'QUALITATIVE_OR_MIXED_RESEARCH',
    availableInPaths: ['QUALITATIVE_OR_MIXED_RESEARCH'],
    requiredInputs: [],
    optionalInputs: [],
    producedOutputs: ['qualitativeCodes', 'thematicMap'],
    prerequisites: [],
    nextRecommendedTools: [],
    dataClassification: 'CONFIDENTIAL',
    status: 'STABLE'
  },
  {
    id: 'outcomePredictor',
    currentView: 'outcomePredictor',
    titleKey: 'outcomePredictor',
    descriptionKey: 'outcomePredictor_desc',
    iconName: 'Brain',
    primaryPath: 'FUTURE_OUTCOME_FORECAST',
    availableInPaths: ['FUTURE_OUTCOME_FORECAST', 'NEW_STUDY_DESIGN', 'ACTIVE_FIELD_STUDY', 'COMPLETED_STUDY_ANALYSIS', 'THESIS_DEFENSE_PREPARATION', 'MANUSCRIPT_PUBLICATION'],
    requiredInputs: [],
    optionalInputs: ['literaturePrior', 'simulatedScenarios', 'fidelity'],
    producedOutputs: [
      'predictedOutcome', 
      'predictionIntervals', 
      'probabilityOfSignificance', 
      'expectedPower', 
      'expectedAttrition', 
      'predictionQuality', 
      'featureContributions', 
      'recommendations'
    ],
    prerequisites: [],
    nextRecommendedTools: [],
    dataClassification: 'SENSITIVE',
    status: 'STABLE'
  }
];
