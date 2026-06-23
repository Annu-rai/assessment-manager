import { useEffect, useState } from 'react';
import api from '../api/client.js';

// Render an answer value nicely regardless of its type.
function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.join(', ');
  if (answer === true) return 'Yes';
  if (answer === false) return 'No';
  if (answer === null || answer === undefined || answer === '') return '—';
  return String(answer);
}

export default function Reports() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api
      .get('/responses')
      .then((res) => setResponses(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Group a response's answers by category -> factor for structured display.
  const grouped = (answers) => {
    const map = {};
    for (const a of answers) {
      const cat = a.categoryName || 'Uncategorised';
      const factor = a.factorName || 'General';
      map[cat] = map[cat] || {};
      map[cat][factor] = map[cat][factor] || [];
      map[cat][factor].push(a);
    }
    return map;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="muted">Submitted responses, grouped by assessment.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && responses.length === 0 && (
        <div className="empty-state card">
          <p>No responses yet. Take an assessment from the Launch Pad.</p>
        </div>
      )}

      {responses.map((r) => {
        const open = openId === r._id;
        return (
          <div className="card report-card" key={r._id}>
            <button className="report-head" onClick={() => setOpenId(open ? null : r._id)}>
              <div>
                <h3>{r.assessment?.title || 'Untitled assessment'}</h3>
                <span className="muted small">
                  {new Date(r.createdAt).toLocaleString()} · {r.answers.length} answers
                </span>
              </div>
              <span className="accordion-toggle">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="report-body">
                {Object.entries(grouped(r.answers)).map(([cat, factors]) => (
                  <div className="report-category" key={cat}>
                    <h4>{cat}</h4>
                    {Object.entries(factors).map(([factor, items]) => (
                      <div className="report-factor" key={factor}>
                        <h5>{factor}</h5>
                        <table className="report-table">
                          <tbody>
                            {items.map((a, i) => (
                              <tr key={i}>
                                <td className="report-q">{a.questionText}</td>
                                <td className="report-a">{formatAnswer(a.answer)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
