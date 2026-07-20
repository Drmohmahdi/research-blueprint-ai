// Route path constants — single source of truth mapped to the Baseerah Academic Suite
export const ROUTES = {
  // Portal Gateway
  PORTAL:            '/app',
  DASHBOARD:         '/app/research', // maps to the core research dashboard for backward compatibility

  // Research Module
  PATHS:             '/app/research/paths',
  DECISION_CENTER:   '/app/research/decisions',
  PLANNING:          '/app/research/planning',
  MEASUREMENT:       '/app/research/study-design/measurement',
  ANALYSIS_PLAN:     '/app/research/study-design/analysis-plan',
  WIZARD:            '/app/research/wizard',
  ANALYZER:          '/app/research/study-design/analyzer',
  CONSISTENCY:       '/app/research/study-design/consistency',
  MODEL_BUILDER:     '/app/research/study-design/model',
  SAMPLE_CALC:       '/app/research/study-design/sample',
  SIMULATION:        '/app/research/simulation/lab',
  PREDICTOR:         '/app/research/simulation/predictor',
  DATA_QUALITY:      '/app/research/field/data-quality',
  PRE_REGISTRATION:  '/app/research/field/pre-registration',
  FIELD_MONITORING:  '/app/research/field/monitoring',
  LIT_SYNTHESIZER:   '/app/research/literature/synthesizer',
  PRISMA:            '/app/research/literature/prisma',
  QUALITATIVE:       '/app/research/literature/qualitative',
  PROGRESS:          '/app/research/progress',
  ASSISTANT:         '/app/research/study-design/assistant',

  // Publishing Module
  PUBLISHING:        '/app/publishing',
  REVIEW_SIM:        '/app/publishing/review',
  EXPORT:            '/app/publishing/export',

  // Peer Review Module
  PEER_REVIEW:       '/app/peer-review',
  PEER_REVIEW_ASSIGNMENTS: '/app/peer-review/assignments',

  // Promotion Module
  PROMOTION:         '/app/promotion',
  PROMOTION_REGULATIONS: '/app/promotion/regulations',

  // Academic Visibility Module (5th Module)
  VISIBILITY:        '/app/visibility',
  VISIBILITY_AUDIT:  '/app/visibility/audit',
  VISIBILITY_PLAN:   '/app/visibility/plan',

  // Unified Academic Profile & Assets Routes
  PROFILE:            '/app/profile',
  PROFILE_IDENTIFIERS: '/app/profile/identifiers',
  PROFILE_AFFILIATIONS: '/app/profile/affiliations',
  ASSETS:             '/app/assets',
  ASSET_DETAILS:      '/app/assets/:assetId',


  // System
  DESIGN_SYSTEM:     '/system/design',
  SMOKE_TEST:        '/system/smoke',
  WORKSPACES:        '/saas/workspaces',
  BILLING:           '/saas/billing',
  AUDIT_LOGS:        '/saas/audit',
  ADMIN_CENTER:      '/admin/settings',

  // New Study Design Routes
  NEW_STUDY_DESIGN:      '/app/research/projects/:projectId/design',
  NEW_STUDY_DESIGN_STEP: '/app/research/projects/:projectId/design/:stepId',


  // Dynamic Workspace Routes


  SEMINAR_PROPOSAL: '/organizations/:organizationId/projects/:projectId/paths/seminar-proposal',
  SEMINAR_PROPOSAL_STEP: '/organizations/:organizationId/projects/:projectId/paths/seminar-proposal/:stepId',
  THESIS_DEFENSE: '/organizations/:organizationId/projects/:projectId/paths/thesis-defense',
  THESIS_DEFENSE_STEP: '/organizations/:organizationId/projects/:projectId/paths/thesis-defense/:stepId',
} as const;

export type RouteKey  = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

/** Maps old currentView string IDs → URL paths (backward compatibility) */
export const VIEW_TO_PATH: Record<string, string> = {
  portal:             ROUTES.PORTAL,
  dashboard:          ROUTES.DASHBOARD,
  pathSelector:       ROUTES.PATHS,
  decisionCenter:     ROUTES.DECISION_CENTER,
  planning:           ROUTES.PLANNING,
  measurement:        ROUTES.MEASUREMENT,
  analysisPlan:       ROUTES.ANALYSIS_PLAN,
  wizard:             ROUTES.WIZARD,
  analyzer:           ROUTES.ANALYZER,
  consistency:        ROUTES.CONSISTENCY,
  modelBuilder:       ROUTES.MODEL_BUILDER,
  sampleCalc:         ROUTES.SAMPLE_CALC,
  simulation:         ROUTES.SIMULATION,
  outcomePredictor:   ROUTES.PREDICTOR,
  dataQuality:        ROUTES.DATA_QUALITY,
  preReg:             ROUTES.PRE_REGISTRATION,
  fidelity:           ROUTES.FIELD_MONITORING,
  litSynthesizer:     ROUTES.LIT_SYNTHESIZER,
  prisma:             ROUTES.PRISMA,
  qualitative:        ROUTES.QUALITATIVE,
  reviewSim:          ROUTES.REVIEW_SIM,
  progress:           ROUTES.PROGRESS,
  assistant:          ROUTES.ASSISTANT,
  peerReview:         ROUTES.PEER_REVIEW,
  export:             ROUTES.EXPORT,
  promotion:          ROUTES.PROMOTION,
  visibility:         ROUTES.VISIBILITY,
  visibilityAudit:    ROUTES.VISIBILITY_AUDIT,
  visibilityPlan:     ROUTES.VISIBILITY_PLAN,
  profile:            ROUTES.PROFILE,
  profileIdentifiers: ROUTES.PROFILE_IDENTIFIERS,
  profileAffiliations: ROUTES.PROFILE_AFFILIATIONS,
  assets:             ROUTES.ASSETS,
  assetDetails:       ROUTES.ASSET_DETAILS,

  designSystem:       ROUTES.DESIGN_SYSTEM,
  smokeTest:          ROUTES.SMOKE_TEST,
  saasWorkspaces:     ROUTES.WORKSPACES,
  saasBilling:        ROUTES.BILLING,
  saasAudit:          ROUTES.AUDIT_LOGS,
  adminCenter:        ROUTES.ADMIN_CENTER,
  newStudyDesign:     ROUTES.NEW_STUDY_DESIGN,
  newStudyDesignStep: ROUTES.NEW_STUDY_DESIGN_STEP,
  seminarProposal:    ROUTES.SEMINAR_PROPOSAL,
  seminarProposalStep: ROUTES.SEMINAR_PROPOSAL_STEP,
  thesisDefense:      ROUTES.THESIS_DEFENSE,
  thesisDefenseStep:  ROUTES.THESIS_DEFENSE_STEP,
};

/** Maps URL paths → old view IDs */
export const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([k, v]) => [v, k])
);
