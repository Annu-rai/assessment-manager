import { useEffect, useState } from 'react';
import api from '../api/client.js';

// Shows an AI role-fit recommendation for a candidate (Module 38).
export default function AIRecommendationModal({ candidateId, candidateName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/ai/recommendation/${candidateId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>✨ Role fit — {candidateName}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading && <p className="muted">Analyzing performance…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {data && (
          <div className="rec-body">
            <p className="ai-summary">{data.summary}</p>

            <h4>Suggested roles</h4>
            <div className="rec-roles">
              {data.suggestedRoles.map((r, i) => (
                <div className="rec-role" key={i}>
                  <div className="rec-role-head">
                    <span className="rec-role-name">{r.role}</span>
                    <span className={`conf conf-${r.confidence}`}>{r.confidence}</span>
                  </div>
                  <div className="muted small">{r.reason}</div>
                </div>
              ))}
            </div>

            <div className="rec-cols">
              <div>
                <h4>Strengths</h4>
                <ul className="rec-list good">
                  {data.strengths.map((s, i) => <li key={i}>✅ {s}</li>)}
                </ul>
              </div>
              <div>
                <h4>Gaps</h4>
                <ul className="rec-list bad">
                  {data.gaps.map((g, i) => <li key={i}>⚠️ {g}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
