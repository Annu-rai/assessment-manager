import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../constants/roles.js';

/**
 * Gate for role-restricted routes. Signed-out users go to /login; signed-in
 * users lacking an allowed role are bounced to their own home page.
 */
export default function RoleRoute({ allow }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
