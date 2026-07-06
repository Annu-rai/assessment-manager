import { useEffect, useState } from 'react';
import api from '../api/client.js';

// Friendly labels + icons for known actions.
const ACTION_META = {
  'auth.login': { label: 'Logged in', icon: '🔑' },
  'org.register': { label: 'Registered org', icon: '🏢' },
  'assessment.create': { label: 'Created assessment', icon: '📝' },
  'assessment.delete': { label: 'Deleted assessment', icon: '🗑' },
  'assessment.invite': { label: 'Sent invites', icon: '✉️' },
  'user.create': { label: 'Added member', icon: '👤' },
  'user.update': { label: 'Updated member', icon: '✏️' },
  'user.deactivate': { label: 'Deactivated member', icon: '🚫' },
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/audit')
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p className="muted">A trail of important actions in your organization.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="empty-state card"><p>No activity recorded yet.</p></div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const meta = ACTION_META[l.action] || { label: l.action, icon: '•' };
                return (
                  <tr key={l._id}>
                    <td className="muted small">{new Date(l.createdAt).toLocaleString()}</td>
                    <td>{l.actorName || '—'}</td>
                    <td>{meta.icon} {meta.label}</td>
                    <td className="muted">{l.target}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
