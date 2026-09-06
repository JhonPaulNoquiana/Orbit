import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import BoardPage from './pages/BoardPage.jsx';

function AppRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <div className="boot"><div className="brand-mark">O</div><span>Getting your workspace ready…</span></div>;
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="/" element={session ? <WorkspacePage /> : <Navigate to="/login" />} />
      <Route path="/boards/:boardId" element={session ? <BoardPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
