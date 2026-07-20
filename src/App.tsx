import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { LayoutV2 } from './components/LayoutV2';
import { Login } from './components/Login';
import { AppRouter } from './router/AppRouter';

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

// ── Inner app — reads router context, renders layout or login screen ─────────
const AppContent: React.FC = () => {
  const { user } = useProject();

  // If user is not authenticated, show the secure premium login page
  if (!user) {
    return <Login />;
  }

  // Otherwise, render full application shell with routing
  return (
    <LayoutV2>
      <AppRouter />
    </LayoutV2>
  );
};

export default App;
