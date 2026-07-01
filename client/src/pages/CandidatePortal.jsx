import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

export default function CandidatePortal() {
  const [assessments, setAssessments] = useState([]);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/assessments'), api.get('/responses')])
      .then(([a, r]) => {
        setAssessments(a.data);
        setResponses(r.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Latest response per assessment id, so we can show "completed" state + score.
  const resultByAssessment = new Map();
  for (const r of responses) {
    const aid = r.assessment?._id || r.assessment;
    if (!resultByAssessment.has(aid)) resultByAssessment.set(aid, r);
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  const upcoming = assessments.filter((a) => !resultByAssessment.has(a._id));
  const completed = assessments.filter((a) => resultByAssessment.has(a._id));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>My Assessments</h1>
          <p className="muted">Tests assigned to you, and your results.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section>
        <h2>Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 && <p className="muted">Nothing to take right now. 🎉</p>}
        <div className="card-grid">
          {upcoming.map((a) => (
            <div className="card assessment-card" key={a._id}>
              <h3>{a.title}</h3>
              {a.description && <p className="muted">{a.description}</p>}
              <div className="assessment-meta">
                <span className="badge">{a.questionCount ?? 0} questions</span>
                {a.timeLimitMinutes > 0 && <span className="badge">⏱ {a.timeLimitMinutes} min</span>}
              </div>
              <Link className="btn btn-primary btn-sm" to={`/candidate/take/${a._id}`}>
                ▶ Start
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Completed ({completed.length})</h2>
        {completed.length === 0 && <p className="muted">No results yet.</p>}
        <div className="card-grid">
          {completed.map((a) => {
            const r = resultByAssessment.get(a._id);
            const graded = r.graded;
            const feedback = (r.answers || []).filter((x) => x.aiGraded && x.aiFeedback);
            return (
              <div className="card assessment-card" key={a._id}>
                <h3>{a.title}</h3>
                {graded ? (
                  <>
                    <div className={`score-ring ${r.passed ? 'pass' : 'fail'}`}>{r.percentage}%</div>
                    <div className="assessment-meta">
                      <span className="badge">{r.score} / {r.maxScore} pts</span>
                      <span className={`status-badge ${r.passed ? 'status-published' : 'status-archived'}`}>
                        {r.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="muted">Submitted — no automatic score for this assessment.</p>
                )}
                {feedback.length > 0 && (
                  <div className="candidate-feedback">
                    <span className="muted small">Feedback</span>
                    {feedback.map((x, i) => (
                      <p className="feedback-line" key={i}>💬 {x.aiFeedback}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
