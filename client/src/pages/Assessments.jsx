import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

export default function Assessments() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

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

  const publicUrl = (publicId) => `${window.location.origin}/t/${publicId}`;

  // Toggle the public share link for an assessment (Module 14).
  const toggleShare = async (a) => {
    setError('');
    try {
      const { data } = await api.post(`/assessments/${a._id}/public-link`, { enabled: !a.isPublic });
      setAssessments((list) =>
        list.map((x) => (x._id === a._id ? { ...x, isPublic: data.isPublic, publicId: data.publicId } : x))
      );
      if (data.isPublic && data.publicId) copyLink(data.publicId);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyLink = async (publicId) => {
    try {
      await navigator.clipboard.writeText(publicUrl(publicId));
      setCopied(publicId);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard may be blocked; the link is still shown to copy manually */
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
              {a.isPublic && <span className="status-badge status-published">Public</span>}
            </div>

            {a.isPublic && a.publicId && (
              <div className="share-box">
                <input readOnly value={publicUrl(a.publicId)} onFocus={(e) => e.target.select()} />
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(a.publicId)}>
                  {copied === a.publicId ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            )}

            <div className="card-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/launch-pad/${a._id}`)}>
                ▶ Launch
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleShare(a)}>
                {a.isPublic ? '🔒 Unshare' : '🔗 Share link'}
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
