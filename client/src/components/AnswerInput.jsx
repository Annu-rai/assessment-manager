import { useState } from 'react';
import api from '../api/client.js';

// Uploads a file to the API and reports back the stored URL as the answer.
// `uploadPath` differs for authenticated (/uploads) vs public (/public/uploads) takers.
function FileAnswer({ question, value, onChange, uploadPath }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(uploadPath, form);
      onChange(data.url);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="answer-file">
      <input type="file" accept={question.accept || undefined} onChange={onFile} disabled={busy} />
      {busy && <span className="muted small">Uploading…</span>}
      {value && (
        <a className="uploaded-link" href={value} target="_blank" rel="noreferrer">
          ✓ Uploaded file
        </a>
      )}
      {err && <span className="alert alert-error">{err}</span>}
    </div>
  );
}

// Match: candidate picks the right item for each left item (dropdowns).
function MatchAnswer({ question, value, onChange }) {
  const map = value && typeof value === 'object' ? value : {};
  const rights = (question.pairs || []).map((p) => p.right);
  return (
    <div className="answer-match">
      {(question.pairs || []).map((p, i) => (
        <div className="match-row" key={i}>
          <span className="match-left">{p.left}</span>
          <span className="pair-arrow">→</span>
          <select
            value={map[p.left] || ''}
            onChange={(e) => onChange({ ...map, [p.left]: e.target.value })}
          >
            <option value="">Select…</option>
            {rights.map((r, ri) => (
              <option key={ri} value={r}>{r}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the correct input control for a question type. Shared by the
 * authenticated Launch Pad and the public (anonymous) take page.
 */
export default function AnswerInput({ question, value, onChange, uploadPath = '/uploads' }) {
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

  if (type === 'essay') {
    return (
      <textarea
        className="answer-text answer-essay"
        rows={5}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer…"
      />
    );
  }

  if (type === 'numerical') {
    return (
      <input
        className="answer-text"
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        placeholder="Enter a number…"
      />
    );
  }

  if (type === 'fill_blank') {
    return (
      <input
        className="answer-text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Fill in the blank…"
      />
    );
  }

  if (type === 'match') {
    return <MatchAnswer question={question} value={value} onChange={onChange} />;
  }

  if (['file_upload', 'audio', 'video', 'image_based'].includes(type)) {
    return <FileAnswer question={question} value={value} onChange={onChange} uploadPath={uploadPath} />;
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
