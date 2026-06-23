import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

export default function Assessments() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/assessments')
      .then((res) => setAssessments(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id) => {
    if (!window.confirm('Delete this assessment? This cannot be undone.')) return;
    try {
      await api.delete(`/assessments/${id}`);
      setAssessments((list) => list.filter((a) => a._id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Assessments</h1>
          <p className="muted">Your saved assessments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/builder')}>
          + New in Builder
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && assessments.length === 0 && (
        <div className="empty-state card">
          <p>No assessments yet. Head to the Builder to create one.</p>
          <button className="btn btn-primary" onClick={() => navigate('/builder')}>
            Go to Builder
          </button>
        </div>
      )}

      <div className="card-grid">
        {assessments.map((a) => (
          <div className="card assessment-card" key={a._id}>
            <h3>{a.title}</h3>
            {a.description && <p className="muted">{a.description}</p>}
            <div className="assessment-meta">
              <span className="badge">{a.categories?.length || 0} categories</span>
              <span className="badge">{a.questionCount ?? 0} questions</span>
            </div>
            <div className="card-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/launch-pad/${a._id}`)}>
                ▶ Launch
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(a._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
