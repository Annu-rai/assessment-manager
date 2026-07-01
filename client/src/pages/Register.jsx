import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      await register(form.name, form.email, form.password, form.organizationName);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Create your organization</h1>
        <p className="muted">Sign up as the admin of a new organization.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Organization name
          <input
            name="organizationName"
            value={form.organizationName}
            onChange={onChange}
            placeholder="Acme Inc."
          />
        </label>
        <label>
          Your name
          <input name="name" value={form.name} onChange={onChange} placeholder="Jane Doe" required />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="At least 6 characters"
            required
          />
        </label>

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
