import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { uid } from '../api/uid.js';
import QuestionSettingsModal, { QUESTION_TYPE_META } from '../components/QuestionSettingsModal.jsx';
import LoadCategoriesModal from '../components/LoadCategoriesModal.jsx';
import QuestionEditor from '../components/QuestionEditor.jsx';

// Build blank question slots from the type/count map chosen in the settings popup.
function buildQuestions(counts) {
  const questions = [];
  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      questions.push({
        _localId: uid('q'),
        text: '',
        type,
        options: QUESTION_TYPE_META[type]?.hasOptions ? ['', ''] : [],
        ratingScale: 5,
      });
    }
  }
  return questions;
}

const emptyState = { title: '', description: '', categories: [] };

export default function Builder() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyState);
  const [expanded, setExpanded] = useState(new Set());
  const [settingsFor, setSettingsFor] = useState(null); // { catId, factorId, factorName }
  const [showLoad, setShowLoad] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // ---- expand/collapse helpers ----
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const isOpen = (id) => expanded.has(id);

  // ---- immutable tree updates ----
  const setCategories = (categories) => setDraft((d) => ({ ...d, categories }));

  const updateCategory = (catId, fn) =>
    setCategories(draft.categories.map((c) => (c._localId === catId ? fn(c) : c)));

  const updateFactor = (catId, factorId, fn) =>
    updateCategory(catId, (cat) => ({
      ...cat,
      factors: cat.factors.map((f) => (f._localId === factorId ? fn(f) : f)),
    }));

  // ---- category ops ----
  const addCategory = () => {
    const id = uid('cat');
    setCategories([...draft.categories, { _localId: id, name: 'New Category', factors: [] }]);
    setExpanded((prev) => new Set(prev).add(id));
  };

  const removeCategory = (catId) =>
    setCategories(draft.categories.filter((c) => c._localId !== catId));

  // ---- factor ops ----
  const addFactor = (catId) => {
    const id = uid('factor');
    updateCategory(catId, (cat) => ({
      ...cat,
      factors: [...cat.factors, { _localId: id, name: 'New Factor', questions: [] }],
    }));
    setExpanded((prev) => new Set(prev).add(id));
  };

  const removeFactor = (catId, factorId) =>
    updateCategory(catId, (cat) => ({
      ...cat,
      factors: cat.factors.filter((f) => f._localId !== factorId),
    }));

  // ---- question ops ----
  const applyQuestionSettings = (counts) => {
    const { catId, factorId } = settingsFor;
    const generated = buildQuestions(counts);
    updateFactor(catId, factorId, (f) => ({ ...f, questions: [...f.questions, ...generated] }));
    setSettingsFor(null);
  };

  const updateQuestion = (catId, factorId, question) =>
    updateFactor(catId, factorId, (f) => ({
      ...f,
      questions: f.questions.map((q) => (q._localId === question._localId ? question : q)),
    }));

  const removeQuestion = (catId, factorId, qId) =>
    updateFactor(catId, factorId, (f) => ({
      ...f,
      questions: f.questions.filter((q) => q._localId !== qId),
    }));

  // ---- load categories (append) ----
  const appendLoadedCategories = (loaded) => {
    const cloned = loaded.map((c) => ({
      _localId: uid('cat'),
      name: c.name,
      factors: (c.factors || []).map((f) => ({
        _localId: uid('factor'),
        name: f.name,
        questions: (f.questions || []).map((q) => ({
          _localId: uid('q'),
          text: q.text,
          type: q.type,
          options: q.options || [],
          ratingScale: q.ratingScale || 5,
        })),
      })),
    }));
    setCategories([...draft.categories, ...cloned]);
    setShowLoad(false);
  };

  // ---- validation + save ----
  const validate = () => {
    if (!draft.title.trim()) return 'Please give the assessment a title.';
    if (draft.categories.length === 0) return 'Add at least one category.';
    for (const cat of draft.categories) {
      if (!cat.name.trim()) return 'Every category needs a name.';
      for (const f of cat.factors) {
        if (!f.name.trim()) return `Every factor in "${cat.name}" needs a name.`;
        for (const q of f.questions) {
          if (!q.text.trim()) return `Every question in "${f.name}" needs text.`;
        }
      }
    }
    return '';
  };

  // Strip local-only fields before sending to the API.
  const serialize = () => ({
    title: draft.title.trim(),
    description: draft.description.trim(),
    categories: draft.categories.map((c) => ({
      name: c.name.trim(),
      factors: c.factors.map((f) => ({
        name: f.name.trim(),
        questions: f.questions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          options: (q.options || []).filter((o) => o.trim() !== ''),
          ratingScale: q.ratingScale,
        })),
      })),
    })),
  });

  const handleSave = async () => {
    setError('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await api.post('/assessments', serialize());
      setDraft(emptyState); // reset builder to empty state
      setExpanded(new Set());
      navigate('/assessments');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalQuestions = draft.categories.reduce(
    (s, c) => s + c.factors.reduce((s2, f) => s2 + f.questions.length, 0),
    0
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Builder</h1>
          <p className="muted">Create a structured assessment: Category → Factor → Questions.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setShowLoad(true)}>
            ⬇ Load Categories
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Assessment'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="builder-meta card">
        <label>
          Assessment title
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="e.g. Q3 Engineering Culture Survey"
          />
        </label>
        <label>
          Description (optional)
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Short description"
          />
        </label>
        <div className="builder-stats">
          {draft.categories.length} categories · {totalQuestions} questions
        </div>
      </div>

      {draft.categories.length === 0 && (
        <div className="empty-state card">
          <p>No categories yet.</p>
          <button className="btn btn-primary" onClick={addCategory}>
            + Add Category
          </button>
        </div>
      )}

      {/* Category accordion */}
      {draft.categories.map((cat) => (
        <div className="accordion accordion-category" key={cat._localId}>
          <div className="accordion-head">
            <button className="accordion-toggle" onClick={() => toggle(cat._localId)}>
              {isOpen(cat._localId) ? '▾' : '▸'}
            </button>
            <input
              className="accordion-title"
              value={cat.name}
              onChange={(e) => updateCategory(cat._localId, (c) => ({ ...c, name: e.target.value }))}
            />
            <span className="badge">{cat.factors.length} factors</span>
            <button className="btn-icon" onClick={() => removeCategory(cat._localId)} title="Delete category">
              🗑
            </button>
          </div>

          {isOpen(cat._localId) && (
            <div className="accordion-body">
              {cat.factors.length === 0 && <p className="muted small">No factors yet.</p>}

              {/* Factor accordion */}
              {cat.factors.map((factor) => (
                <div className="accordion accordion-factor" key={factor._localId}>
                  <div className="accordion-head">
                    <button className="accordion-toggle" onClick={() => toggle(factor._localId)}>
                      {isOpen(factor._localId) ? '▾' : '▸'}
                    </button>
                    <input
                      className="accordion-title"
                      value={factor.name}
                      onChange={(e) =>
                        updateFactor(cat._localId, factor._localId, (f) => ({
                          ...f,
                          name: e.target.value,
                        }))
                      }
                    />
                    <span className="badge">{factor.questions.length} questions</span>
                    <button
                      className="btn-icon"
                      onClick={() => removeFactor(cat._localId, factor._localId)}
                      title="Delete factor"
                    >
                      🗑
                    </button>
                  </div>

                  {isOpen(factor._localId) && (
                    <div className="accordion-body">
                      {factor.questions.map((q, idx) => (
                        <QuestionEditor
                          key={q._localId}
                          question={q}
                          index={idx}
                          onChange={(updated) => updateQuestion(cat._localId, factor._localId, updated)}
                          onRemove={() => removeQuestion(cat._localId, factor._localId, q._localId)}
                        />
                      ))}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setSettingsFor({
                            catId: cat._localId,
                            factorId: factor._localId,
                            factorName: factor.name,
                          })
                        }
                      >
                        ⚙ Add Questions
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn btn-secondary btn-sm" onClick={() => addFactor(cat._localId)}>
                + Add Factor
              </button>
            </div>
          )}
        </div>
      ))}

      {draft.categories.length > 0 && (
        <button className="btn btn-primary add-category-btn" onClick={addCategory}>
          + Add Category
        </button>
      )}

      {settingsFor && (
        <QuestionSettingsModal
          factorName={settingsFor.factorName}
          onApply={applyQuestionSettings}
          onClose={() => setSettingsFor(null)}
        />
      )}

      {showLoad && (
        <LoadCategoriesModal onSelect={appendLoadedCategories} onClose={() => setShowLoad(false)} />
      )}
    </div>
  );
}
