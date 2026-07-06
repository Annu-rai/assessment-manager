import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { ROLE_LABELS } from '../constants/roles.js';

// Global search results (Module 27).
export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInput(q);
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get(`/search?q=${encodeURIComponent(q)}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  };

  const total = data ? data.assessments.length + data.users.length + data.questions.length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Search</h1>
          <p className="muted">Find assessments, members, and bank questions.</p>
        </div>
      </div>

      <form className="chat-input" onSubmit={submit} style={{ marginBottom: '1rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search…"
          autoFocus
        />
        <button className="btn btn-primary">Search</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Searching…</p>}
      {data && total === 0 && <p className="muted">No results for “{q}”.</p>}

      {data && data.assessments.length > 0 && (
        <section className="card">
          <h2>Assessments</h2>
          <ul className="search-list">
            {data.assessments.map((a) => (
              <li key={a._id} onClick={() => navigate(`/launch-pad/${a._id}`)}>
                <span className="search-title">{a.title}</span>
                <span className={`status-badge status-${a.status}`}>{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.users.length > 0 && (
        <section className="card">
          <h2>Members</h2>
          <ul className="search-list">
            {data.users.map((u) => (
              <li key={u._id} onClick={() => navigate('/team')}>
                <span className="search-title">{u.name}</span>
                <span className="muted">{u.email}</span>
                <span className="role-badge">{ROLE_LABELS[u.role] || u.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.questions.length > 0 && (
        <section className="card">
          <h2>Bank Questions</h2>
          <ul className="search-list">
            {data.questions.map((qq) => (
              <li key={qq._id} onClick={() => navigate('/bank')}>
                <span className="search-title">{qq.text}</span>
                <span className={`diff-badge diff-${qq.difficulty}`}>{qq.difficulty}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
