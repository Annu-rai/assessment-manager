import { QUESTION_TYPE_META } from './QuestionSettingsModal.jsx';

/**
 * Editor for a single question inside the Builder. Renders the right inputs
 * for the question's type (options list for choice types, scale for rating).
 */
export default function QuestionEditor({ question, index, onChange, onRemove }) {
  const meta = QUESTION_TYPE_META[question.type] || { label: question.type, hasOptions: false };

  const update = (patch) => onChange({ ...question, ...patch });

  const updateOption = (i, value) => {
    const options = [...question.options];
    options[i] = value;
    update({ options });
  };

  const addOption = () => update({ options: [...question.options, ''] });

  const removeOption = (i) =>
    update({ options: question.options.filter((_, idx) => idx !== i) });

  return (
    <div className="question-editor">
      <div className="question-editor-head">
        <span className="badge badge-type">
          Q{index + 1} · {meta.label}
        </span>
        <button className="btn-icon" onClick={onRemove} title="Remove question">
          🗑
        </button>
      </div>

      <input
        className="question-text"
        value={question.text}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="Enter question text…"
      />

      {meta.hasOptions && (
        <div className="options-block">
          {question.options.map((opt, i) => (
            <div className="option-row" key={i}>
              <span className="option-bullet">{question.type === 'single_choice' ? '○' : '☐'}</span>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              <button className="btn-icon" onClick={() => removeOption(i)} title="Remove option">
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addOption}>
            + Add option
          </button>
        </div>
      )}

      {question.type === 'rating' && (
        <label className="inline-field">
          Scale (max)
          <input
            type="number"
            min="2"
            max="10"
            value={question.ratingScale}
            onChange={(e) =>
              update({ ratingScale: Math.max(2, Math.min(10, parseInt(e.target.value, 10) || 5)) })
            }
          />
        </label>
      )}

      {question.type === 'boolean' && <p className="muted small">Respondents answer Yes or No.</p>}
      {question.type === 'text' && <p className="muted small">Respondents type a free-text answer.</p>}
    </div>
  );
}
