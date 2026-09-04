import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import { ROUTES } from './routes';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SkeletonGrid } from '../components/SkeletonCard';
import { AdminGuard } from '../components/AdminGuard';
import { PermissionGuard } from '../components/PermissionGuard';

// ── Lazy-loaded components ────────────────────────────────────────────────────
const PortalGateway             = lazy(() => import('../components/PortalGateway').then(m => ({ default: m.PortalGateway })));
const ResearchPathSelector      = lazy(() => import('../components/ResearchPathSelector').then(m => ({ default: m.ResearchPathSelector })));
const ResearchDecisionCenter    = lazy(() => import('../components/ResearchDecisionCenter').then(m => ({ default: m.ResearchDecisionCenter })));
const ResearchPlanning          = lazy(() => import('../components/ResearchPlanning').then(m => ({ default: m.ResearchPlanning })));
const MeasurementInstruments    = lazy(() => import('../components/MeasurementInstruments').then(m => ({ default: m.MeasurementInstruments })));
const AnalysisPlan               = lazy(() => import('../components/AnalysisPlan').then(m => ({ default: m.AnalysisPlan })));
const TitleAnalyzer             = lazy(() => import('../components/TitleAnalyzer').then(m => ({ default: m.TitleAnalyzer })));
const ConsistencyChecker        = lazy(() => import('../components/ConsistencyChecker').then(m => ({ default: m.ConsistencyChecker })));
const ModelBuilder              = lazy(() => import('../components/ModelBuilder').then(m => ({ default: m.ModelBuilder })));
const SampleSizeCalc            = lazy(() => import('../components/SampleSizeCalc').then(m => ({ default: m.SampleSizeCalc })));
const SimulationLab             = lazy(() => import('../components/SimulationLab').then(m => ({ default: m.SimulationLab })));
const ResearchOutcomePredictor  = lazy(() => import('../components/ResearchOutcomePredictor').then(m => ({ default: m.ResearchOutcomePredictor })));
const DataInspector             = lazy(() => import('../components/DataInspector').then(m => ({ default: m.DataInspector })));
const ResearchDataStudio        = lazy(() => import('../features/research-data/ResearchDataStudio').then(m => ({ default: m.ResearchDataStudio })));
const ResearchLifecycleCommandCenter = lazy(() => import('../features/research-lifecycle/ResearchLifecycleCommandCenter').then(m => ({ default: m.ResearchLifecycleCommandCenter })));
const PreRegistration           = lazy(() => import('../components/PreRegistration').then(m => ({ default: m.PreRegistration })));
const FieldMonitoring           = lazy(() => import('../components/FieldMonitoring').then(m => ({ default: m.FieldMonitoring })));
const LiteratureSynthesizer     = lazy(() => import('../components/LiteratureSynthesizer').then(m => ({ default: m.LiteratureSynthesizer })));
const PrismaBuilder             = lazy(() => import('../components/PrismaBuilder').then(m => ({ default: m.PrismaBuilder })));
const QualitativeLab            = lazy(() => import('../components/QualitativeLab').then(m => ({ default: m.QualitativeLab })));
const PublicationReadinessReviewer = lazy(() => import('../components/PublicationReadinessReviewer').then(m => ({ default: m.PublicationReadinessReviewer })));
const PublicationCommandCenter = lazy(() => import('../features/publication/PublicationCommandCenter'));
const MethodologyChat             = lazy(() => import('../features/ai-assistant/MethodologyChat').then(m => ({ default: m.MethodologyChat })));
const ReviewerDashboard           = lazy(() => import('../features/review-portal/ReviewerDashboard').then(m => ({ default: m.ReviewerDashboard })));
const ExportPanel                 = lazy(() => import('../features/report-export/ExportPanel').then(m => ({ default: m.ExportPanel })));
const SmokeTestDashboard        = lazy(() => import('../components/SmokeTestDashboard').then(m => ({ default: m.SmokeTestDashboard })));
const ThesisOperationsCenter    = lazy(() => import('../features/thesis/ThesisOperationsCenter'));
const GraduateStudiesDashboard  = lazy(() => import('../features/thesis/GraduateStudiesDashboard'));

const DesignSystemUnavailable: React.FC = () => (
  <div className="p-6">
    <h2 className="text-xl font-semibold">Design system is available in development only.</h2>
  </div>
);

const NotFound: React.FC = () => {
  const { language } = useProject();
  return (
    <section className="mx-auto flex min-h-[45vh] max-w-xl flex-col items-center justify-center gap-4 text-center" aria-labelledby="not-found-title">
      <span className="text-5xl font-black text-ink ds-numeric" aria-hidden="true">404</span>
      <h2 id="not-found-title" className="m-0 text-2xl font-extrabold text-[var(--ds-text-primary)]">
        {language === 'ar' ? 'الصفحة غير موجودة' : 'Page not found'}
      </h2>
      <p className="m-0 text-sm text-[var(--ds-text-secondary)]">
        {language === 'ar' ? 'قد يكون الرابط قد تغير أو لا يتوفر ضمن مساحة عملك.' : 'The link may have changed or may not be available in your workspace.'}
      </p>
      <Link to={ROUTES.PORTAL} className="rounded-lg bg-action px-4 py-2.5 font-bold text-on-action">
        {language === 'ar' ? 'العودة إلى البوابة' : 'Return to portal'}
      </Link>
    </section>
  );
};

const DesignSystemShowcase = import.meta.env.DEV
  ? lazy(() => import('../components/DesignSystemShowcase').then(m => ({ default: m.DesignSystemShowcase })))
  : DesignSystemUnavailable;

// SaaS imports
const OrganizationSwitcher      = lazy(() => import('../features/saas/OrganizationSwitcher').then(m => ({ default: m.OrganizationSwitcher })));
const BillingDashboard          = lazy(() => import('../features/saas/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const SuperAdminDashboard        = lazy(() => import('../features/saas/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const NewStudyDesignWorkspace   = lazy(() => import('../features/saas/NewStudyDesignWorkspace').then(m => ({ default: m.NewStudyDesignWorkspace })));
const ResearchOfficeOperations    = lazy(() => import('../features/research-design/ResearchOfficeOperations').then(m => ({ default: m.ResearchOfficeOperations })));
const SeminarProposalWorkspace  = lazy(() => import('../features/saas/SeminarProposalWorkspace').then(m => ({ default: m.SeminarProposalWorkspace })));
const ThesisDefenseWorkspace    = lazy(() => import('../features/saas/ThesisDefenseWorkspace').then(m => ({ default: m.ThesisDefenseWorkspace })));
const AdminCenter                = lazy(() => import('../components/AdminCenter').then(m => ({ default: m.AdminCenter })));

// Promotion Module
const PromotionDashboard        = lazy(() => import('../components/PromotionDashboard').then(m => ({ default: m.PromotionDashboard })));

// Academic Visibility Module
const AcademicVisibilityDashboard = lazy(() => import('../components/AcademicVisibilityDashboard').then(m => ({ default: m.AcademicVisibilityDashboard })));
const AcademicVisibilityReports   = lazy(() => import('../components/AcademicVisibilityReports').then(m => ({ default: m.AcademicVisibilityReports })));

// Unified Profile & Assets Components
const UnifiedProfileEditor = lazy(() => import('../components/UnifiedProfileEditor').then(m => ({ default: m.UnifiedProfileEditor })));
const ScholarlyAssetsList  = lazy(() => import('../components/ScholarlyAssetsList').then(m => ({ default: m.ScholarlyAssetsList })));
const SearchPage           = lazy(() => import('../components/SearchPage').then(m => ({ default: m.SearchPage })));

// ── Fallback loading UI ───────────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="p-6">
    <SkeletonGrid />
  </div>
);

// ── Route wrapper: ErrorBoundary + Suspense ───────────────────────────────────
const SafeRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

import { useProject } from '../context/ProjectContext';

const WizardToDesign: React.FC = () => {
  const { activeProject } = useProject();
  if (activeProject?.id) {
    return <Navigate to={ROUTES.NEW_STUDY_DESIGN.replace(':projectId', activeProject.id)} replace />;
  }
  return <Navigate to={ROUTES.PATHS} replace />;
};

const ProjectDesignHome: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProject } = useProject();
  const id = projectId || activeProject?.id;
  if (!id) return <Navigate to={ROUTES.PATHS} replace />;
  return <Navigate to={ROUTES.NEW_STUDY_DESIGN.replace(':projectId', id)} replace />;
};

// ── App Router ────────────────────────────────────────────────────────────────
export const AppRouter: React.FC = () => {
  const { language } = useProject();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.PORTAL} replace />} />
      {/* Portal Gateway Route */}
      <Route path={ROUTES.PORTAL}           element={<SafeRoute><PortalGateway /></SafeRoute>} />
      
      {/* Research Module Routes */}
      <Route path={ROUTES.DASHBOARD}        element={<Navigate to={ROUTES.LIFECYCLE} replace />} />
      <Route path={ROUTES.LIFECYCLE}        element={<SafeRoute><ResearchLifecycleCommandCenter /></SafeRoute>} />
      <Route path={ROUTES.PATHS}            element={<SafeRoute><ResearchPathSelector /></SafeRoute>} />
      <Route path={ROUTES.DECISION_CENTER}  element={<SafeRoute><ResearchDecisionCenter /></SafeRoute>} />
      <Route path={ROUTES.PLANNING}         element={<SafeRoute><ResearchPlanning /></SafeRoute>} />
      <Route path={ROUTES.MEASUREMENT}      element={<SafeRoute><MeasurementInstruments /></SafeRoute>} />
      <Route path={ROUTES.ANALYSIS_PLAN}    element={<SafeRoute><AnalysisPlan /></SafeRoute>} />
      <Route path={ROUTES.WIZARD}           element={<SafeRoute><WizardToDesign /></SafeRoute>} />
      <Route path={ROUTES.ANALYZER}         element={<SafeRoute><TitleAnalyzer /></SafeRoute>} />
      <Route path={ROUTES.CONSISTENCY}      element={<SafeRoute><ConsistencyChecker /></SafeRoute>} />
      <Route path={ROUTES.MODEL_BUILDER}    element={<SafeRoute><ModelBuilder /></SafeRoute>} />
      <Route path={ROUTES.SAMPLE_CALC}      element={<SafeRoute><SampleSizeCalc /></SafeRoute>} />
      <Route path="/app/research/simulation" element={<Navigate to={ROUTES.SIMULATION} replace />} />
      <Route path={ROUTES.SIMULATION}       element={<SafeRoute><SimulationLab /></SafeRoute>} />
      <Route path={ROUTES.PREDICTOR}        element={<SafeRoute><ResearchOutcomePredictor /></SafeRoute>} />
      <Route path={ROUTES.DATA_QUALITY}     element={<SafeRoute><DataInspector /></SafeRoute>} />
      <Route path={ROUTES.RESEARCH_DATA}    element={<SafeRoute><ResearchDataStudio /></SafeRoute>} />
      <Route path={ROUTES.PRE_REGISTRATION} element={<SafeRoute><PreRegistration /></SafeRoute>} />
      <Route path={ROUTES.FIELD_MONITORING} element={<SafeRoute><FieldMonitoring /></SafeRoute>} />
      <Route path={ROUTES.LIT_SYNTHESIZER}  element={<SafeRoute><LiteratureSynthesizer /></SafeRoute>} />
      <Route path={ROUTES.PRISMA}           element={<SafeRoute><PrismaBuilder /></SafeRoute>} />
      <Route path={ROUTES.QUALITATIVE}      element={<SafeRoute><QualitativeLab /></SafeRoute>} />
      <Route path={ROUTES.PROGRESS}         element={<Navigate to={ROUTES.LIFECYCLE} replace />} />
      <Route path={ROUTES.ASSISTANT}        element={<SafeRoute><MethodologyChat /></SafeRoute>} />
      {/* Publishing Module Routes */}
      <Route path={ROUTES.PUBLISHING}       element={<SafeRoute><PublicationCommandCenter /></SafeRoute>} />
      <Route path={ROUTES.REVIEW_SIM}       element={<SafeRoute><PublicationReadinessReviewer /></SafeRoute>} />
      <Route path={ROUTES.EXPORT}           element={<SafeRoute><ExportPanel /></SafeRoute>} />

      {/* Peer Review Module Routes */}
      <Route path={ROUTES.PEER_REVIEW}             element={<SafeRoute><ReviewerDashboard /></SafeRoute>} />
      <Route path={ROUTES.PEER_REVIEW_ASSIGNMENTS} element={<SafeRoute><ReviewerDashboard /></SafeRoute>} />

      {/* Promotion Module Routes */}
      <Route path={ROUTES.PROMOTION}         element={<SafeRoute><PromotionDashboard /></SafeRoute>} />
      <Route path={ROUTES.PROMOTION_REGULATIONS} element={<SafeRoute><PromotionDashboard /></SafeRoute>} />

      {/* Academic Visibility Module Routes */}
      <Route path={ROUTES.VISIBILITY}         element={<SafeRoute><AcademicVisibilityDashboard /></SafeRoute>} />
      <Route path={ROUTES.VISIBILITY_AUDIT}   element={<SafeRoute><AcademicVisibilityDashboard /></SafeRoute>} />
      <Route path={ROUTES.VISIBILITY_PLAN}    element={<SafeRoute><AcademicVisibilityDashboard /></SafeRoute>} />
      <Route path={ROUTES.VISIBILITY_REPORTS} element={<SafeRoute><AcademicVisibilityReports /></SafeRoute>} />

      {/* Unified Profile & Assets Routes */}
      <Route path={ROUTES.PROFILE}             element={<SafeRoute><UnifiedProfileEditor /></SafeRoute>} />
      <Route path={ROUTES.PROFILE_IDENTIFIERS} element={<SafeRoute><UnifiedProfileEditor /></SafeRoute>} />
      <Route path={ROUTES.PROFILE_AFFILIATIONS} element={<SafeRoute><UnifiedProfileEditor /></SafeRoute>} />
      <Route path={ROUTES.ASSETS}              element={<SafeRoute><ScholarlyAssetsList /></SafeRoute>} />
      <Route path={ROUTES.ASSET_DETAILS}       element={<SafeRoute><ScholarlyAssetsList /></SafeRoute>} />


      {/* Phase 09 — Unified Search */}
      <Route path={ROUTES.SEARCH}             element={<SafeRoute><SearchPage /></SafeRoute>} />

      {/* System — Admin/Dev only routes */}
      <Route path={ROUTES.DESIGN_SYSTEM} element={
        <SafeRoute>
          <AdminGuard>
            <DesignSystemShowcase />
          </AdminGuard>
        </SafeRoute>
      } />
      <Route path={ROUTES.SMOKE_TEST} element={
        <SafeRoute>
          <AdminGuard>
            <SmokeTestDashboard />
          </AdminGuard>
        </SafeRoute>
      } />

      {/* SaaS & Administration */}
      <Route path={ROUTES.WORKSPACES}       element={<SafeRoute><OrganizationSwitcher language={language} /></SafeRoute>} />
      <Route path={ROUTES.BILLING}          element={<SafeRoute><PermissionGuard permission="billing.view"><BillingDashboard language={language} /></PermissionGuard></SafeRoute>} />
      <Route path={ROUTES.AUDIT_LOGS}       element={<SafeRoute><PermissionGuard permission="audit.view"><SuperAdminDashboard language={language} /></PermissionGuard></SafeRoute>} />
      <Route path={ROUTES.ADMIN_CENTER} element={
        <SafeRoute>
          <AdminGuard>
            <AdminCenter />
          </AdminGuard>
        </SafeRoute>
      } />

      {/* Study Design Path Routes */}
      <Route path={ROUTES.NEW_STUDY_DESIGN} element={<SafeRoute><NewStudyDesignWorkspace /></SafeRoute>} />
      <Route path={ROUTES.NEW_STUDY_DESIGN_STEP} element={<SafeRoute><NewStudyDesignWorkspace /></SafeRoute>} />
      <Route path={ROUTES.RESEARCH_COMMAND_CENTER} element={<SafeRoute><ProjectDesignHome /></SafeRoute>} />
      <Route path={ROUTES.RESEARCH_OFFICE} element={<SafeRoute><ResearchOfficeOperations /></SafeRoute>} />

      {/* Seminar Proposal Path Routes */}
      <Route path={ROUTES.SEMINAR_PROPOSAL} element={<SafeRoute><SeminarProposalWorkspace /></SafeRoute>} />
      <Route path={ROUTES.SEMINAR_PROPOSAL_STEP} element={<SafeRoute><SeminarProposalWorkspace /></SafeRoute>} />

      {/* Thesis Defense Path Routes */}
      <Route path={ROUTES.THESIS_DEFENSE} element={<SafeRoute><ThesisDefenseWorkspace /></SafeRoute>} />
      <Route path={ROUTES.THESIS_DEFENSE_STEP} element={<SafeRoute><ThesisDefenseWorkspace /></SafeRoute>} />
      <Route path={ROUTES.THESIS_OPERATIONS} element={<SafeRoute><ThesisOperationsCenter /></SafeRoute>} />
      <Route path={ROUTES.GRADUATE_STUDIES} element={<SafeRoute><GraduateStudiesDashboard /></SafeRoute>} />

      {/* Explicit not-found experience; does not reveal resource existence. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
