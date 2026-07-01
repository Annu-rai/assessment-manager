import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isCandidate } from '../constants/roles.js';
import AnswerInput from '../components/AnswerInput.jsx';

export default function LaunchPad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Candidates take tests from their portal; staff use the Launch Pad picker.
  const candidate = isCandidate(user);
  const listPath = candidate ? '/candidate' : '/launch-pad';
  const startPath = (aid) => (candidate ? `/candidate/take/${aid}` : `/launch-pad/${aid}`);
  const resultsPath = candidate ? '/candidate' : '/reports';
  const resultsLabel = candidate ? 'View my results' : 'View in Reports';

  const [list, setList] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({}); // questionId -> answer
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null); // seconds remaining, null = untimed

  // Load the list of assessments (for the picker) and, if an id is in the URL,
  // the full assessment to take.
  useEffect(() => {
    setLoading(true);
    setDone(false);
    setAnswers({});
    const reqs = [api.get('/assessments')];
    if (id) reqs.push(api.get(`/assessments/${id}`));

    Promise.all(reqs)
      .then(([listRes, oneRes]) => {
        setList(listRes.data);
        setAssessment(oneRes ? oneRes.data : null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const flatQuestions = useMemo(() => {
    if (!assessment) return [];
    const out = [];
    assessment.categories.forEach((cat) =>
      cat.factors.forEach((f) =>
        f.questions.forEach((q) =>
          out.push({ ...q, categoryName: cat.name, factorName: f.name })
        )
      )
    );
    return out;
  }, [assessment]);

  const setAnswer = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));

  const answeredCount = flatQuestions.filter((q) => {
    const v = answers[q._id];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== null;
  }).length;

  const handleSubmit = async (auto = false) => {
    setError('');
    const payload = {
      assessmentId: assessment._id,
      answers: Object.entries(answers)
        .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== '' && v != null))
        .map(([questionId, answer]) => ({ questionId, answer })),
    };
    if (payload.answers.length === 0 && !auto) {
      setError('Please answer at least one question before submitting.');
      return;
    }
    if (payload.answers.length === 0 && auto) {
      // Time expired with nothing answered â€” just end the attempt.
      setDone(true);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/responses', payload);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Timer (Module 11): start the countdown when a timed assessment loads,
  // tick every second, and auto-submit when it hits zero. ---
  useEffect(() => {
    if (assessment && assessment.timeLimitMinutes > 0 && !done) {
      setTimeLeft((prev) => (prev === null ? assessment.timeLimitMinutes * 60 : prev));
    }
  }, [assessment, done]);

  useEffect(() => {
    if (timeLeft === null || done) return undefined;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return undefined;
    }
    const t = setTimeout(() => setTimeLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, done]);

  const mmss = (secs) =>
    `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  // --- assessment picker (no id selected) ---
  if (!id) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Launch Pad</h1>
            <p className="muted">Pick an assessment to take.</p>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {loading && <p className="muted">Loadingâ€¦</p>}
        {!loading && list.length === 0 && (
          <div className="empty-state card">
            <p>No assessments available. Create one in the Builder first.</p>
          </div>
        )}
        <div className="card-grid">
          {list.map((a) => (
            <div className="card assessment-card" key={a._id}>
              <h3>{a.title}</h3>
              {a.description && <p className="muted">{a.description}</p>}
              <div className="assessment-meta">
                <span className="badge">{a.questionCount ?? 0} questions</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(startPath(a._id))}>
                â–¶ Start
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"><p className="muted">Loadingâ€¦</p></div>;

  if (done) {
    return (
      <div className="page">
        <div className="empty-state card success">
          <h2>âœ“ Response submitted</h2>
          <p className="muted">Thanks! Your answers were recorded.</p>
          <div className="card-actions center">
            <button className="btn btn-primary" onClick={() => navigate(resultsPath)}>
              {resultsLabel}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(listPath)}>
              {candidate ? 'Back to portal' : 'Take another'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="page">
        <div className="alert alert-error">{error || 'Assessment not found.'}</div>
        <button className="btn btn-ghost" onClick={() => navigate(listPath)}>
          â† Back
        </button>
      </div>
    );
  }

  let qNumber = 0;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(listPath)}>
            â† Back
          </button>
          <h1>{assessment.title}</h1>
          {assessment.description && <p className="muted">{assessment.description}</p>}
        </div>
        <div className="take-status">
          {timeLeft !== null && (
            <div className={`timer-pill ${timeLeft <= 30 ? 'urgent' : ''}`}>â± {mmss(timeLeft)}</div>
          )}
          <div className="progress-pill">
            {answeredCount} / {flatQuestions.length} answered
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {assessment.categories.map((cat, ci) => (
        <div className="take-category" key={ci}>
          <h2 className="take-category-title">{cat.name}</h2>
          {cat.factors.map((factor, fi) => (
            <div className="take-factor" key={fi}>
              <h3 className="take-factor-title">{factor.name}</h3>
              {factor.questions.map((q) => {
                qNumber += 1;
                return (
                  <div className="take-question card" key={q._id}>
                    <div className="take-question-text">
                      <span className="q-number">{qNumber}.</span> {q.text}
                    </div>
                    <AnswerInput
                      question={q}
                      value={answers[q._id]}
                      onChange={(val) => setAnswer(q._id, val)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      <div className="submit-bar">
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submittingâ€¦' : 'Submit responses'}
        </button>
      </div>
    </div>
  );
}
