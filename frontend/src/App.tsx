import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { JobsPage } from './pages/JobsPage';
import { CandidateProfilePage } from './pages/CandidateProfilePage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <Router>
      <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-neutral-950 font-sans antialiased transition-colors duration-300">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <Routes>
            <Route path="/" element={<Board />} />
            <Route path="/candidates" element={<Board />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/candidate/new" element={<CandidateProfilePage />} />
            <Route path="/candidate/:id" element={<CandidateProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
