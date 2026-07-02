import { useState } from 'react';
import api from '../api/client.js';

// Labels for the AI-supported question types.
const TYPE_OPTIONS = [
  { key: 'single_choice', label: 'Single Choice' },
  { key: 'multiple_choice', label: 'Multiple Choice' },
  { key: 'boolean', label: 'Yes / No' },
  { key: 'numerical', label: 'Numerical' },
  { key: 'fill_blank', label: 'Fill Blank' },
  { key: 'essay', label: 'Essay' },
];

/**
 * Generate questions with Claude (Module 5) and hand them back to the Builder.
 */
export default function AIGenerateModal({ factorName, onAdd, onClose }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('mixed');
  const [types, setTypes] = useState(['single_choice', 'multiple_choice']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleType = (key) =>
    setTypes((t) => (t.includes(key) ? t.filter((x) => x !== key) : [...t, key]));

  const generate = async () => {
    setError('');
    if (!topic.trim()) {
      setError('Please enter a topic.');
      return;
    }
    if (types.length === 0) {
      setError('Pick at least one question type.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/ai/generate-questions', {
        topic: topic.trim(),
        count,
        types,
        difficulty,
      });
      if (!data.questions?.length) {
        setError('The AI returned no questions. Try a different topic.');
        return;
      }
      onAdd(data.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>✨ Generate questions with AI</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="muted">
          Adding to <strong>{factorName}</strong>. Claude will draft questions with answer keys.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. React Hooks, SQL joins, Newton's laws"
            autoFocus
          />
        </label>

        <div className="type-fields">
          <label className="inline-field">
            How many
            <input
              type="number"
              min="1"
              max="25"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(25, parseInt(e.target.value, 10) || 1)))}
            />
          </label>
          <label className="inline-field">
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="mixed">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>

        <div className="ai-types">
          <span className="muted small">Question types:</span>
          <div className="ai-type-chips">
            {TYPE_OPTIONS.map((o) => (
              <label key={o.key} className={types.includes(o.key) ? 'type-chip active' : 'type-chip'}>
                <input
                  type="checkbox"
                  checked={types.includes(o.key)}
                  onChange={() => toggleType(o.key)}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <span className="muted small">{busy ? 'Claude is thinking…' : ''}</span>
          <div>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : '✨ Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
