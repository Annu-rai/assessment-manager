import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';

// Renders the correct input control for a question type.
function AnswerInput({ question, value, onChange }) {
  const { type, options = [], ratingScale = 5 } = question;

  if (type === 'text') {
    return (
      <input
        className="answer-text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer…"
      />
    );
  }

  if (type === 'boolean') {
    return (
      <div className="answer-choices">
        {['Yes', 'No'].map((opt) => (
          <label key={opt} className="choice">
            <input
              type="radio"
              name={question._id}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (type === 'rating') {
    return (
      <div className="answer-rating">
        {Array.from({ length: ratingScale }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={Number(value) === n ? 'rating-pill active' : 'rating-pill'}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (type === 'single_choice') {
    return (
      <div className="answer-choices">
        {options.map((opt, i) => (
          <label key={i} className="choice">
            <input
              type="radio"
              name={question._id}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  // multiple_choice (select many) -> array value
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);

  return (
    <div className="answer-choices">
      {options.map((opt, i) => (
        <label key={i} className="choice">
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

export default function LaunchPad() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({}); // questionId -> answer
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

  const handleSubmit = async () => {
    setError('');
    const payload = {
      assessmentId: assessment._id,
      answers: Object.entries(answers)
        .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== '' && v != null))
        .map(([questionId, answer]) => ({ questionId, answer })),
    };
    if (payload.answers.length === 0) {
      setError('Please answer at least one question before submitting.');
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
        {loading && <p className="muted">Loading…</p>}
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
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/launch-pad/${a._id}`)}>
                ▶ Start
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  if (done) {
    return (
      <div className="page">
        <div className="empty-state card success">
          <h2>✓ Response submitted</h2>
          <p className="muted">Thanks! Your answers were recorded.</p>
          <div className="card-actions center">
            <button className="btn btn-primary" onClick={() => navigate('/reports')}>
              View in Reports
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/launch-pad')}>
              Take another
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
        <button className="btn btn-ghost" onClick={() => navigate('/launch-pad')}>
          ← Back
        </button>
      </div>
    );
  }

  let qNumber = 0;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/launch-pad')}>
            ← Back
          </button>
          <h1>{assessment.title}</h1>
          {assessment.description && <p className="muted">{assessment.description}</p>}
        </div>
        <div className="progress-pill">
          {answeredCount} / {flatQuestions.length} answered
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
          {submitting ? 'Submitting…' : 'Submit responses'}
        </button>
      </div>
    </div>
  );
}
