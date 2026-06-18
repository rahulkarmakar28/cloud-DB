import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewDatabase from './pages/NewDatabase';
import DatabaseDetail from './pages/DatabaseDetail';
import { Login, Register } from './pages/Auth';
import { Docs, Settings } from './pages/misc';
import { Spinner } from './components/ui';

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <Spinner size={36} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <Sidebar />
      <main style={{ marginLeft:220, flex:1, padding:28, maxWidth:'calc(100vw - 220px)', overflow:'auto' }}>
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/new"     element={<NewDatabase />} />
          <Route path="/db/:id"  element={<DatabaseDetail />} />
          <Route path="/docs"    element={<Docs />} />
          <Route path="/settings"element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight:'100vh', background:'var(--bg)' }} />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/*"        element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
