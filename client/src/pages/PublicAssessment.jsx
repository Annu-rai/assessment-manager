import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import AnswerInput from '../components/AnswerInput.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function PublicAssessment() {
  const { publicId } = useParams();
  const { theme, toggleTheme } = useTheme();

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [who, setWho] = useState({ name: '', email: '' });
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get(`/public/assessments/${publicId}`)
      .then((res) => setAssessment(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [publicId]);

  const flatCount = useMemo(() => {
    if (!assessment) return 0;
    return assessment.categories.reduce(
      (s, c) => s + c.factors.reduce((s2, f) => s2 + f.questions.length, 0),
      0
    );
  }, [assessment]);

  const setAnswer = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));

  const submit = async (auto = false) => {
    setError('');
    const payload = {
      name: who.name,
      email: who.email,
      answers: Object.entries(answers)
        .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== '' && v != null))
        .map(([questionId, answer]) => ({ questionId, answer })),
    };
    if (payload.answers.length === 0) {
      if (auto) setResult({ submitted: true });
      else setError('Please answer at least one question.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/public/assessments/${publicId}/submit`, payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Timer: start on begin, auto-submit at zero.
  useEffect(() => {
    if (started && assessment?.timeLimitMinutes > 0 && timeLeft === null && !result) {
      setTimeLeft(assessment.timeLimitMinutes * 60);
    }
  }, [started, assessment, timeLeft, result]);

  useEffect(() => {
    if (timeLeft === null || result) return undefined;
    if (timeLeft <= 0) {
      submit(true);
      return undefined;
    }
    const t = setTimeout(() => setTimeLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, result]);

  const ThemeBtn = () => (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );

  if (loading) return <div className="centered-screen">Loading…</div>;
  if (error && !assessment) {
    return (
      <div className="public-shell">
        <div className="card empty-state">
          <h2>Link unavailable</h2>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className="public-shell">
        <div className="card empty-state success">
          <h2>✓ Submitted</h2>
          {result.graded ? (
            <>
              <div className={`score-ring ${result.passed ? 'pass' : 'fail'}`}>{result.percentage}%</div>
              <p className="muted">
                You scored {result.score} / {result.maxScore} — {result.passed ? 'Passed' : 'Not passed'}.
              </p>
            </>
          ) : (
            <p className="muted">Thanks! Your responses were recorded.</p>
          )}
        </div>
      </div>
    );
  }

  // Intro / identity gate
  if (!started) {
    return (
      <div className="public-shell">
        <div className="public-topbar">
          <span className="navbar-brand">📋 {assessment.title}</span>
          <ThemeBtn />
        </div>
        <div className="card">
          {assessment.description && <p className="muted">{assessment.description}</p>}
          <ul className="muted small">
            <li>{flatCount} questions</li>
            {assessment.timeLimitMinutes > 0 && <li>⏱ {assessment.timeLimitMinutes} minute time limit</li>}
          </ul>
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            Your name
            <input
              value={who.name}
              onChange={(e) => setWho({ ...who, name: e.target.value })}
              placeholder="Jane Doe"
            />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              value={who.email}
              onChange={(e) => setWho({ ...who, email: e.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              if (!who.name.trim()) {
                setError('Please enter your name.');
                return;
              }
              setError('');
              setStarted(true);
            }}
          >
            Start assessment
          </button>
        </div>
      </div>
    );
  }

  // Take view
  let qn = 0;
  return (
    <div className="public-shell wide">
      <div className="public-topbar">
        <span className="navbar-brand">📋 {assessment.title}</span>
        <div className="take-status">
          {timeLeft !== null && (
            <div className={`timer-pill ${timeLeft <= 30 ? 'urgent' : ''}`}>⏱ {mmss(timeLeft)}</div>
          )}
          <ThemeBtn />
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
                qn += 1;
                return (
                  <div className="take-question card" key={q._id}>
                    <div className="take-question-text">
                      <span className="q-number">{qn}.</span> {q.text}
                    </div>
                    <AnswerInput
                      question={q}
                      value={answers[q._id]}
                      onChange={(val) => setAnswer(q._id, val)}
                      uploadPath="/public/uploads"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      <div className="submit-bar">
        <button className="btn btn-primary btn-lg" onClick={() => submit(false)} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit responses'}
        </button>
      </div>
    </div>
  );
}
