import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { ROLE_LABELS, isAdmin, isCandidate } from '../constants/roles.js';

// Links shown to staff (recruiter/interviewer/trainer/admin). Admin-only and
// candidate links are added conditionally below.
const STAFF_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/builder', label: 'Builder' },
  { to: '/bank', label: 'Question Bank' },
  { to: '/assessments', label: 'Assessments' },
  { to: '/launch-pad', label: 'Launch Pad' },
  { to: '/reports', label: 'Reports' },
  { to: '/assistant', label: 'Assistant' },
];

const CANDIDATE_LINKS = [{ to: '/candidate', label: 'My Assessments' }];

export default function Navbar() {
  const { user, organization, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let links = isCandidate(user) ? CANDIDATE_LINKS : [...STAFF_LINKS];
  if (isAdmin(user)) links = [...links, { to: '/team', label: 'Team' }];

  return (
    <header className="navbar">
      <div className="navbar-brand">
        📋 {organization?.name || 'Assessment Manager'}
      </div>
      <nav className="navbar-links">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="navbar-user">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span className="navbar-username">
          {user?.name}
          {user?.role && <span className="role-badge">{ROLE_LABELS[user.role] || user.role}</span>}
        </span>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
