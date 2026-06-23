import { useEffect, useState } from 'react';
import api from '../api/client.js';

/**
 * "Load Categories" popup. Lists the user's previously saved category templates
 * and lets them select one or more to append to the current Builder session.
 */
export default function LoadCategoriesModal({ onSelect, onClose }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAppend = () => {
    const chosen = categories.filter((c) => selected.has(c._id));
    onSelect(chosen);
  };

  const questionCount = (c) =>
    (c.factors || []).reduce((s, f) => s + (f.questions?.length || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Load categories</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && categories.length === 0 && (
          <p className="muted">No saved categories yet. Save an assessment to build your library.</p>
        )}

        {categories.length > 0 && (
          <ul className="load-list">
            {categories.map((c) => (
              <li key={c._id} className={selected.has(c._id) ? 'load-item selected' : 'load-item'}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(c._id)}
                    onChange={() => toggle(c._id)}
                  />
                  <span className="load-item-name">{c.name}</span>
                  <span className="badge">
                    {c.factors?.length || 0} factors · {questionCount(c)} questions
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-footer">
          <span className="muted">{selected.size} selected</span>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAppend} disabled={selected.size === 0}>
              Append selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
