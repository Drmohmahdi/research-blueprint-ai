import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { LayoutV2 } from './components/LayoutV2';
import { Login } from './components/Login';
import { AppRouter } from './router/AppRouter';
import { PublicResearcherProfile } from './components/PublicResearcherProfile';
import { MarketingSite } from './marketing/MarketingSite';
import { TermsOfService } from './marketing/TermsOfService';
import { PrivacyPolicy } from './marketing/PrivacyPolicy';
import { PublicNotFound } from './marketing/PublicNotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isWorkspacePath } from './router/routes';

const ExternalReviewerPortal = lazy(() => import('./features/review-portal/ExternalReviewerPortal').then(module => ({ default: module.ExternalReviewerPortal })));
const ExternalThesisExaminerPortal = lazy(() => import('./features/thesis/ExternalThesisExaminerPortal'));

// ── App wrapped in BrowserRouter + ProjectProvider ────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

// ── Inner app — reads router context, renders public routes, login, or the app shell ─
const AppContent: React.FC = () => {
  const { user } = useProject();
  const location = useLocation();
  const hasPasswordResetToken = new URLSearchParams(location.search).has('token');
  const home = user ? <Navigate to="/app" replace /> : <MarketingSite />;

  return (
    <Routes>
      {/* Public marketing — signed-in users hitting home go to the workspace */}
      <Route path="/" element={home} />
      <Route path="/home" element={home} />
      <Route path="/features" element={<MarketingSite />} />
      <Route path="/solutions" element={<MarketingSite />} />
      <Route path="/how-it-works" element={<MarketingSite />} />
      <Route path="/pricing" element={<MarketingSite />} />
      <Route path="/faq" element={<MarketingSite />} />
      <Route path="/about" element={<MarketingSite />} />
      <Route path="/contact" element={<MarketingSite />} />
      <Route path="/institutional" element={<MarketingSite />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />
      <Route path="/signup" element={<Navigate to="/login?mode=register" replace />} />
      <Route path="/login" element={user && !hasPasswordResetToken ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/researcher/:username" element={<PublicResearcherProfile />} />
      <Route
        path="/external-review/:token"
        element={<Suspense fallback={<div role="status" className="p-6 text-center">Loading review portal…</div>}><ExternalReviewerPortal /></Suspense>}
      />
      <Route path="/thesis-examination/:token" element={<Suspense fallback={<div role="status" className="p-6 text-center">Loading examination portal…</div>}><ExternalThesisExaminerPortal /></Suspense>} />

      {/* Everything else requires authentication */}
      <Route
        path="/*"
        element={
          user ? (
            <LayoutV2>
              <AppRouter />
            </LayoutV2>
          ) : isWorkspacePath(location.pathname) ? (
            <Login />
          ) : (
            <PublicNotFound />
          )
        }
      />
    </Routes>
  );
};

export default App;
