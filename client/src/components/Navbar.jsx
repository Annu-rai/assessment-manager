import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/builder', label: 'Builder' },
  { to: '/assessments', label: 'Assessments' },
  { to: '/launch-pad', label: 'Launch Pad' },
  { to: '/reports', label: 'Reports' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">📋 Assessment Manager</div>
      <nav className="navbar-links">
        {LINKS.map((l) => (
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
        <span className="navbar-username">{user?.name}</span>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
