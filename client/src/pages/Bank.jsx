import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { uid } from '../api/uid.js';
import QuestionEditor from '../components/QuestionEditor.jsx';
import { QUESTION_TYPE_META } from '../components/QuestionSettingsModal.jsx';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

// A blank editable question of the given type (mirrors the Builder's defaults).
export function blankQuestion(type = 'single_choice') {
  const meta = QUESTION_TYPE_META[type] || {};
  return {
    _localId: uid('q'),
    text: '',
    type,
    options: meta.hasOptions ? ['', ''] : [],
    ratingScale: 5,
    correctAnswer: null,
    points: 1,
    tolerance: 0,
    pairs: type === 'match' ? [{ left: '', right: '' }] : [],
    accept: meta.accept || '',
  };
}

// Strip local-only fields before sending a question to the API.
function serialize(q, meta) {
  return {
    text: q.text.trim(),
    type: q.type,
    options: (q.options || []).filter((o) => o.trim() !== ''),
    ratingScale: q.ratingScale,
    correctAnswer: q.correctAnswer ?? null,
    points: Number(q.points) || 1,
    tolerance: Number(q.tolerance) || 0,
    pairs: (q.pairs || []).filter((p) => p.left.trim() !== '' && p.right.trim() !== ''),
    accept: q.accept || '',
    topic: meta.topic.trim(),
    difficulty: meta.difficulty,
    tags: meta.tags.split(',').map((t) => t.trim()).filter(Boolean),
  };
}

const emptyMeta = { topic: '', difficulty: 'medium', tags: '' };

export default function Bank() {
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ type: '', difficulty: '', search: '' });
  const [draft, setDraft] = useState(() => blankQuestion());
  const [meta, setMeta] = useState(emptyMeta);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    api
      .get(`/questions?${params.toString()}`)
      .then((res) => setQuestions(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // Reload whenever filters change.
  useEffect(load, [filters]);

  const changeType = (type) => setDraft(blankQuestion(type));

  const save = async () => {
    setError('');
    setNotice('');
    if (!draft.text.trim()) {
      setError('Question text is required.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/questions', serialize(draft, meta));
      setNotice('Question added to the bank.');
      setDraft(blankQuestion(draft.type));
      setMeta(emptyMeta);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/questions/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Question Bank</h1>
          <p className="muted">A reusable pool of questions with tags, difficulty and topics.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {/* Add form */}
      <section className="card">
        <h2>Add a question</h2>
        <div className="inline-form">
          <select value={draft.type} onChange={(e) => changeType(e.target.value)}>
            {Object.entries(QUESTION_TYPE_META).map(([t, m]) => (
              <option key={t} value={t}>{m.label}</option>
            ))}
          </select>
          <input
            value={meta.topic}
            onChange={(e) => setMeta({ ...meta, topic: e.target.value })}
            placeholder="Topic (e.g. JavaScript)"
          />
          <select value={meta.difficulty} onChange={(e) => setMeta({ ...meta, difficulty: e.target.value })}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            value={meta.tags}
            onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
            placeholder="tags, comma, separated"
          />
        </div>
        <QuestionEditor
          question={draft}
          index={0}
          onChange={(q) => setDraft(q)}
          onRemove={() => setDraft(blankQuestion(draft.type))}
        />
        <div className="card-actions">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Add to bank'}
          </button>
        </div>
      </section>

      {/* Filters + list */}
      <section className="card">
        <div className="inline-form">
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search text…"
          />
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All types</option>
            {Object.entries(QUESTION_TYPE_META).map(([t, m]) => (
              <option key={t} value={t}>{m.label}</option>
            ))}
          </select>
          <select
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
          >
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <h2>Questions ({questions.length})</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="muted">No questions match. Add some above.</p>
        ) : (
          <ul className="bank-list">
            {questions.map((q) => (
              <li key={q._id} className="bank-item">
                <div className="bank-item-main">
                  <span className="bank-q">{q.text}</span>
                  <div className="bank-tags">
                    <span className="badge">{QUESTION_TYPE_META[q.type]?.label || q.type}</span>
                    <span className={`diff-badge diff-${q.difficulty}`}>{q.difficulty}</span>
                    {q.topic && <span className="badge">{q.topic}</span>}
                    <span className="badge">{q.points} pt</span>
                    {(q.tags || []).map((t) => (
                      <span className="tag-chip" key={t}>#{t}</span>
                    ))}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(q._id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
