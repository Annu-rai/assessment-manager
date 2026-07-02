import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { QUESTION_TYPE_META } from './QuestionSettingsModal.jsx';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Pick questions from the Question Bank to drop into a factor (Module 8).
 * Supports filtered manual selection and a "pull N random" shortcut.
 */
export default function LoadBankModal({ factorName, onAdd, onClose }) {
  const [filters, setFilters] = useState({ type: '', difficulty: '', search: '' });
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [randomCount, setRandomCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    api
      .get(`/questions?${params.toString()}`)
      .then((res) => setQuestions(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addSelected = () => {
    const chosen = questions.filter((q) => selected.has(q._id));
    if (chosen.length) onAdd(chosen);
  };

  const addRandom = async () => {
    setError('');
    try {
      const params = new URLSearchParams({ count: String(randomCount) });
      if (filters.type) params.append('type', filters.type);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      const { data } = await api.get(`/questions/random?${params.toString()}`);
      if (data.length) onAdd(data);
      else setError('No questions matched for random selection.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add from Question Bank → {factorName}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="inline-form">
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search…"
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

        <div className="bank-picker">
          {loading && <p className="muted">Loading…</p>}
          {!loading && questions.length === 0 && <p className="muted">No questions found.</p>}
          {questions.map((q) => (
            <label className="bank-pick-row" key={q._id}>
              <input type="checkbox" checked={selected.has(q._id)} onChange={() => toggle(q._id)} />
              <span className="bank-q">{q.text}</span>
              <span className={`diff-badge diff-${q.difficulty}`}>{q.difficulty}</span>
              <span className="badge">{QUESTION_TYPE_META[q.type]?.label || q.type}</span>
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <div className="random-pull">
            <input
              type="number"
              min="1"
              max="50"
              value={randomCount}
              onChange={(e) => setRandomCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
            />
            <button className="btn btn-ghost" onClick={addRandom}>🎲 Add random</button>
          </div>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={addSelected} disabled={selected.size === 0}>
              Add selected ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
