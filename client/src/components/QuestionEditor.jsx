import { QUESTION_TYPE_META } from './QuestionSettingsModal.jsx';

/**
 * Editor for a single question inside the Builder. Renders the right inputs
 * for the question's type (options list for choice types, scale for rating).
 */
// Question types that can be auto-graded against an answer key.
const GRADEABLE = ['single_choice', 'multiple_choice', 'boolean', 'numerical', 'fill_blank', 'match'];

export default function QuestionEditor({ question, index, onChange, onRemove, onDragStart }) {
  const meta = QUESTION_TYPE_META[question.type] || { label: question.type, hasOptions: false };
  const gradeable = GRADEABLE.includes(question.type);
  const correct = question.correctAnswer;

  const update = (patch) => onChange({ ...question, ...patch });

  const isOptionCorrect = (opt) =>
    question.type === 'multiple_choice'
      ? Array.isArray(correct) && correct.includes(opt)
      : correct === opt;

  // Clicking an option's marker toggles it in/out of the answer key.
  const toggleCorrect = (opt) => {
    if (question.type === 'multiple_choice') {
      const arr = Array.isArray(correct) ? correct : [];
      update({ correctAnswer: arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt] });
    } else {
      update({ correctAnswer: correct === opt ? null : opt });
    }
  };

  const updateOption = (i, value) => {
    const options = [...question.options];
    const old = options[i];
    options[i] = value;
    const patch = { options };
    // Keep the answer key in sync when the correct option's text is edited.
    if (question.type === 'multiple_choice' && Array.isArray(correct) && correct.includes(old)) {
      patch.correctAnswer = correct.map((o) => (o === old ? value : o));
    } else if (correct === old && old !== undefined) {
      patch.correctAnswer = value;
    }
    update(patch);
  };

  const addOption = () => update({ options: [...question.options, ''] });

  // --- match pairs helpers ---
  const updatePair = (i, patch) =>
    update({ pairs: (question.pairs || []).map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const addPair = () => update({ pairs: [...(question.pairs || []), { left: '', right: '' }] });
  const removePair = (i) => update({ pairs: (question.pairs || []).filter((_, idx) => idx !== i) });

  const removeOption = (i) => {
    const removed = question.options[i];
    const patch = { options: question.options.filter((_, idx) => idx !== i) };
    if (question.type === 'multiple_choice' && Array.isArray(correct)) {
      patch.correctAnswer = correct.filter((o) => o !== removed);
    } else if (correct === removed) {
      patch.correctAnswer = null;
    }
    update(patch);
  };

  return (
    <div className="question-editor">
      <div className="question-editor-head">
        {onDragStart && (
          <span className="drag-handle" draggable onDragStart={onDragStart} title="Drag to reorder question">
            ⠿
          </span>
        )}
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
              <button
                type="button"
                className={isOptionCorrect(opt) ? 'option-bullet correct' : 'option-bullet'}
                onClick={() => toggleCorrect(opt)}
                title="Mark as correct answer"
              >
                {isOptionCorrect(opt) ? '✓' : question.type === 'single_choice' ? '○' : '☐'}
              </button>
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
          <p className="muted small">Click the circle/box to mark the correct answer(s).</p>
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

      {question.type === 'boolean' && (
        <label className="inline-field">
          Correct answer
          <select
            value={correct ?? ''}
            onChange={(e) => update({ correctAnswer: e.target.value || null })}
          >
            <option value="">Ungraded</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </label>
      )}
      {question.type === 'text' && <p className="muted small">Respondents type a free-text answer.</p>}
      {question.type === 'essay' && (
        <p className="muted small">Long-form answer. Stored ungraded (AI evaluation comes in Phase 3).</p>
      )}

      {question.type === 'numerical' && (
        <div className="type-fields">
          <label className="inline-field">
            Correct value
            <input
              type="number"
              value={correct ?? ''}
              onChange={(e) => update({ correctAnswer: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          <label className="inline-field">
            ± Tolerance
            <input
              type="number"
              min="0"
              value={question.tolerance ?? 0}
              onChange={(e) => update({ tolerance: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
      )}

      {question.type === 'fill_blank' && (
        <label className="inline-field wide">
          Acceptable answers (comma-separated)
          <input
            value={Array.isArray(correct) ? correct.join(', ') : correct || ''}
            onChange={(e) =>
              update({ correctAnswer: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="e.g. color, colour"
          />
        </label>
      )}

      {question.type === 'match' && (
        <div className="options-block">
          <p className="muted small">Define the correct left → right pairs.</p>
          {(question.pairs || []).map((p, i) => (
            <div className="option-row" key={i}>
              <input
                value={p.left}
                onChange={(e) => updatePair(i, { left: e.target.value })}
                placeholder={`Left ${i + 1}`}
              />
              <span className="pair-arrow">→</span>
              <input
                value={p.right}
                onChange={(e) => updatePair(i, { right: e.target.value })}
                placeholder={`Right ${i + 1}`}
              />
              <button className="btn-icon" onClick={() => removePair(i)} title="Remove pair">
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={addPair}>
            + Add pair
          </button>
        </div>
      )}

      {meta.media && (
        <label className="inline-field wide">
          Accepted file types (optional)
          <input
            value={question.accept || ''}
            onChange={(e) => update({ accept: e.target.value })}
            placeholder='e.g. image/*, application/pdf'
          />
        </label>
      )}

      {gradeable && (
        <label className="inline-field">
          Points
          <input
            type="number"
            min="0"
            value={question.points ?? 1}
            onChange={(e) => update({ points: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          />
        </label>
      )}
    </div>
  );
}
