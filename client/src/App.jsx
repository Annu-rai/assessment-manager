import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import Navbar from './components/Navbar.jsx';
import { STAFF_ROLES, ADMIN_ROLES, ROLES, homeFor } from './constants/roles.js';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Builder from './pages/Builder.jsx';
import Bank from './pages/Bank.jsx';
import Assessments from './pages/Assessments.jsx';
import LaunchPad from './pages/LaunchPad.jsx';
import Reports from './pages/Reports.jsx';
import Team from './pages/Team.jsx';
import Branding from './pages/Branding.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import CandidatePortal from './pages/CandidatePortal.jsx';
import PublicAssessment from './pages/PublicAssessment.jsx';
import Assistant from './pages/Assistant.jsx';
import VerifyCertificate from './pages/VerifyCertificate.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-screen">Loading…</div>;
  }

  const home = user ? homeFor(user) : '/login';

  return (
    <>
      {user && <Navbar />}
      <main className={user ? 'app-main' : ''}>
        <Routes>
          {/* Fully public: anonymous shared assessment link (Module 14) */}
          <Route path="/t/:publicId" element={<PublicAssessment />} />
          {/* Fully public: certificate verification (Module 17) */}
          <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

          {/* Public routes */}
          <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to={home} /> : <Register />} />

          {/* Staff-only routes (admin, recruiter, interviewer, trainer, super admin) */}
          <Route element={<RoleRoute allow={STAFF_ROLES} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/assessments" element={<Assessments />} />
            <Route path="/launch-pad" element={<LaunchPad />} />
            <Route path="/launch-pad/:id" element={<LaunchPad />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/assistant" element={<Assistant />} />
          </Route>

          {/* Admin-only */}
          <Route element={<RoleRoute allow={ADMIN_ROLES} />}>
            <Route path="/team" element={<Team />} />
            <Route path="/branding" element={<Branding />} />
            <Route path="/audit" element={<AuditLogs />} />
          </Route>

          {/* Candidate portal */}
          <Route element={<RoleRoute allow={[ROLES.CANDIDATE]} />}>
            <Route path="/candidate" element={<CandidatePortal />} />
            <Route path="/candidate/take/:id" element={<LaunchPad />} />
          </Route>

          {/* Default */}
          <Route path="*" element={<Navigate to={home} />} />
        </Routes>
      </main>
    </>
  );
}
