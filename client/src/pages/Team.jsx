import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { ROLES, ROLE_LABELS } from '../constants/roles.js';
import ExportButtons from '../components/ExportButtons.jsx';
import AIRecommendationModal from '../components/AIRecommendationModal.jsx';

// Roles an org admin can assign when adding a team member.
const ASSIGNABLE_ROLES = [
  ROLES.CANDIDATE,
  ROLES.RECRUITER,
  ROLES.INTERVIEWER,
  ROLES.TRAINER,
  ROLES.ORG_ADMIN,
];

const emptyForm = { name: '', email: '', password: '', role: ROLES.CANDIDATE };

export default function Team() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [recFor, setRecFor] = useState(null); // candidate for the AI-fit modal
  const [memberFilter, setMemberFilter] = useState({ role: '', status: '' });

  const load = () => {
    setLoading(true);
    api
      .get('/users')
      .then((res) => setUsers(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    api.get('/ai/status').then((r) => setAiEnabled(r.data.enabled)).catch(() => setAiEnabled(false));
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onCreate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post('/users', form);
      setNotice(`Added ${form.name} as ${ROLE_LABELS[form.role]}.`);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id, role) => {
    setError('');
    try {
      await api.put(`/users/${id}`, { role });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deactivate = async (id) => {
    setError('');
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (memberFilter.role && u.role !== memberFilter.role) return false;
    if (memberFilter.status === 'active' && u.isActive === false) return false;
    if (memberFilter.status === 'inactive' && u.isActive !== false) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p className="muted">Manage members and their roles.</p>
        </div>
        <ExportButtons path="/export/candidates" name="members" formats={['csv', 'xlsx']} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card">
        <h2>Add a member</h2>
        <form className="inline-form" onSubmit={onCreate}>
          <input name="name" value={form.name} onChange={onChange} placeholder="Name" required />
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="email@org.com"
            required
          />
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="Temp password (min 6)"
            required
          />
          <select name="role" value={form.role} onChange={onChange}>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="filter-bar" style={{ marginBottom: '0.5rem' }}>
          <select
            value={memberFilter.role}
            onChange={(e) => setMemberFilter({ ...memberFilter, role: e.target.value })}
          >
            <option value="">All roles</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select
            value={memberFilter.status}
            onChange={(e) => setMemberFilter({ ...memberFilter, status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <h2>Members ({filteredUsers.length})</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u._id} className={u.isActive ? '' : 'row-inactive'}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u._id, e.target.value)}>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{u.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="member-actions">
                    {aiEnabled && u.role === ROLES.CANDIDATE && (
                      <button
                        className="btn btn-ai btn-sm"
                        onClick={() => setRecFor(u)}
                        title="AI role-fit recommendation"
                      >
                        ✨ Fit
                      </button>
                    )}
                    {u.isActive && (
                      <button className="btn btn-ghost btn-sm" onClick={() => deactivate(u._id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {recFor && (
        <AIRecommendationModal
          candidateId={recFor._id}
          candidateName={recFor.name}
          onClose={() => setRecFor(null)}
        />
      )}
    </div>
  );
}
