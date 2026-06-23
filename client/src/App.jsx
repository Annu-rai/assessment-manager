import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Navbar from './components/Navbar.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Builder from './pages/Builder.jsx';
import Assessments from './pages/Assessments.jsx';
import LaunchPad from './pages/LaunchPad.jsx';
import Reports from './pages/Reports.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-screen">Loading…</div>;
  }

  return (
    <>
      {user && <Navbar />}
      <main className={user ? 'app-main' : ''}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={user ? <Navigate to="/builder" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/builder" /> : <Register />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/builder" element={<Builder />} />
            <Route path="/assessments" element={<Assessments />} />
            <Route path="/launch-pad" element={<LaunchPad />} />
            <Route path="/launch-pad/:id" element={<LaunchPad />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          {/* Default */}
          <Route path="*" element={<Navigate to={user ? '/builder' : '/login'} />} />
        </Routes>
      </main>
    </>
  );
}
