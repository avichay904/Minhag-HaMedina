import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { SurveysPage } from './pages/SurveysPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { ResultsPage } from './pages/ResultsPage';
import { SourcesPage } from './pages/SourcesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/surveys" replace />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="*" element={<Navigate to="/surveys" replace />} />
      </Route>
    </Routes>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/surveys" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
