import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { LayoutV2 } from './components/LayoutV2';
import { Login } from './components/Login';
import { AppRouter } from './router/AppRouter';
import { PublicResearcherProfile } from './components/PublicResearcherProfile';
import { LandingPage } from './components/LandingPage';

const ExternalReviewerPortal = lazy(() => import('./features/review-portal/ExternalReviewerPortal').then(module => ({ default: module.ExternalReviewerPortal })));

// ── App wrapped in BrowserRouter + ProjectProvider ────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </BrowserRouter>
  );
};

// ── Inner app — reads router context, renders public routes, login, or the app shell ─
const AppContent: React.FC = () => {
  const { user, language } = useProject();

  return (
    <Routes>
      {/* Public marketing routes — signed-in users are sent to their dashboard instead */}
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage language={language} onNavigateToLogin={() => { window.location.href = '/login'; }} />} />
      <Route path="/home" element={user ? <Navigate to="/app" replace /> : <LandingPage language={language} onNavigateToLogin={() => { window.location.href = '/login'; }} />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/researcher/:username" element={<PublicResearcherProfile />} />
      <Route
        path="/external-review/:token"
        element={<Suspense fallback={<div role="status" className="p-6 text-center">Loading review portal…</div>}><ExternalReviewerPortal /></Suspense>}
      />

      {/* Everything else requires authentication */}
      <Route
        path="/*"
        element={
          user ? (
            <LayoutV2>
              <AppRouter />
            </LayoutV2>
          ) : (
            <Login />
          )
        }
      />
    </Routes>
  );
};

export default App;
