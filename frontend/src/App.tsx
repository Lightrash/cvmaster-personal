import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { CandidateProfilePage } from './pages/CandidateProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuthStore } from './store/useAuthStore';

function ProtectedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-neutral-950 font-sans antialiased transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Outlet />
      </main>
    </div>
  );
}

function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return <Navigate replace to={isAuthenticated ? '/' : '/login'} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/candidates" element={<Board />} />
          <Route path="/board" element={<Navigate replace to="/candidates" />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/candidate/new" element={<CandidateProfilePage />} />
          <Route path="/candidate/:id" element={<CandidateProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
