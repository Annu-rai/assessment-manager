import { useState } from 'react';

// The set of supported question types and their human labels.
// gradeable = the scoring engine can auto-grade it; media = answer is an upload.
export const QUESTION_TYPE_META = {
  single_choice: { label: 'Single Choice (select one)', hasOptions: true, gradeable: true },
  multiple_choice: { label: 'Multiple Choice (select many)', hasOptions: true, gradeable: true },
  boolean: { label: 'Yes / No', hasOptions: false, gradeable: true },
  numerical: { label: 'Numerical', hasOptions: false, gradeable: true },
  fill_blank: { label: 'Fill in the Blank', hasOptions: false, gradeable: true },
  match: { label: 'Match Pairs', hasOptions: false, gradeable: true },
  rating: { label: 'Rating (scale)', hasOptions: false, gradeable: false },
  text: { label: 'Text / Short answer', hasOptions: false, gradeable: false },
  essay: { label: 'Essay / Long answer', hasOptions: false, gradeable: false },
  file_upload: { label: 'File Upload', hasOptions: false, gradeable: false, media: true, accept: '' },
  image_based: { label: 'Image Upload', hasOptions: false, gradeable: false, media: true, accept: 'image/*' },
  audio: { label: 'Audio Response', hasOptions: false, gradeable: false, media: true, accept: 'audio/*' },
  video: { label: 'Video Response', hasOptions: false, gradeable: false, media: true, accept: 'video/*' },
};

/**
 * Settings popup shown before questions are added to a factor.
 * The user chooses how many questions of each type to generate; on apply the
 * Builder creates that many blank, editable question slots.
 */
export default function QuestionSettingsModal({ factorName, onApply, onClose }) {
  const [counts, setCounts] = useState(
    Object.keys(QUESTION_TYPE_META).reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
  );

  const setCount = (type, value) => {
    const n = Math.max(0, Math.min(20, parseInt(value, 10) || 0));
    setCounts((c) => ({ ...c, [type]: n }));
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const handleApply = () => {
    if (total === 0) return;
    onApply(counts);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure questions</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="muted">
          Choose how many questions of each type to add to <strong>{factorName}</strong>.
        </p>

        <div className="settings-grid">
          {Object.entries(QUESTION_TYPE_META).map(([type, meta]) => (
            <div className="settings-row" key={type}>
              <label htmlFor={`count-${type}`}>{meta.label}</label>
              <input
                id={`count-${type}`}
                type="number"
                min="0"
                max="20"
                value={counts[type]}
                onChange={(e) => setCount(type, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <span className="muted">{total} question(s)</span>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleApply} disabled={total === 0}>
              Add questions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
