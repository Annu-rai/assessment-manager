import { Fragment, useEffect, useState } from 'react';
import api from '../api/client.js';
import ExportButtons from '../components/ExportButtons.jsx';

const fileUrl = (path) => `${import.meta.env.VITE_API_URL || ''}${path}`;

// Render an answer value nicely regardless of its type.
function formatAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return '—';
  if (Array.isArray(answer)) return answer.join(', ');
  if (answer === true) return 'Yes';
  if (answer === false) return 'No';
  // Match answers arrive as { left: chosenRight }.
  if (typeof answer === 'object') {
    return Object.entries(answer).map(([k, v]) => `${k} → ${v}`).join('; ');
  }
  // Uploaded files are stored as "/uploads/..." paths.
  if (typeof answer === 'string' && answer.startsWith('/uploads/')) {
    return (
      <a href={fileUrl(answer)} target="_blank" rel="noreferrer">
        View file
      </a>
    );
  }
  return String(answer);
}

export default function Reports() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [gradingId, setGradingId] = useState(null);

  useEffect(() => {
    api
      .get('/responses')
      .then((res) => setResponses(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.get('/ai/status').then((r) => setAiEnabled(r.data.enabled)).catch(() => setAiEnabled(false));
  }, []);

  const hasEssay = (r) => r.answers.some((a) => a.type === 'essay');

  // Trigger AI grading for a submission, then swap in the updated response.
  const gradeWithAI = async (id) => {
    setError('');
    setGradingId(id);
    try {
      const { data } = await api.post(`/ai/evaluate-response/${id}`);
      setResponses((list) => list.map((r) => (r._id === id ? { ...r, ...data } : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setGradingId(null);
    }
  };

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
        <ExportButtons path="/export/responses" name="responses" />
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
                  {r.respondent?.name ? `${r.respondent.name} · ` : ''}
                  {new Date(r.createdAt).toLocaleString()} · {r.answers.length} answers
                </span>
              </div>
              <div className="report-head-right">
                {r.graded && (
                  <span className={`status-badge ${r.passed ? 'status-published' : 'status-archived'}`}>
                    {r.percentage}% {r.passed ? 'Pass' : 'Fail'}
                  </span>
                )}
                <span className="accordion-toggle">{open ? '▾' : '▸'}</span>
              </div>
            </button>

            {open && (
              <div className="report-body">
                {aiEnabled && hasEssay(r) && (
                  <div className="report-toolbar">
                    <button
                      className="btn btn-ai btn-sm"
                      onClick={() => gradeWithAI(r._id)}
                      disabled={gradingId === r._id}
                    >
                      {gradingId === r._id ? 'Grading…' : '✨ Grade essays with AI'}
                    </button>
                    {r.aiEvaluatedAt && (
                      <span className="muted small">
                        AI graded {new Date(r.aiEvaluatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {Object.entries(grouped(r.answers)).map(([cat, factors]) => (
                  <div className="report-category" key={cat}>
                    <h4>{cat}</h4>
                    {Object.entries(factors).map(([factor, items]) => (
                      <div className="report-factor" key={factor}>
                        <h5>{factor}</h5>
                        <table className="report-table">
                          <tbody>
                            {items.map((a, i) => (
                              <Fragment key={i}>
                                <tr>
                                  <td className="report-q">{a.questionText}</td>
                                  <td className="report-a">{formatAnswer(a.answer)}</td>
                                  <td className="report-grade">
                                    {a.aiGraded ? (
                                      <span className="ai-score">{a.aiScore}/{a.pointsPossible}</span>
                                    ) : a.isCorrect === true ? (
                                      <span className="mark-correct">✓</span>
                                    ) : a.isCorrect === false ? (
                                      <span className="mark-wrong">✗</span>
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </td>
                                </tr>
                                {a.aiGraded && a.aiFeedback && (
                                  <tr>
                                    <td colSpan={3} className="ai-feedback">💬 {a.aiFeedback}</td>
                                  </tr>
                                )}
                              </Fragment>
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
