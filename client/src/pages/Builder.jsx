import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { uid } from '../api/uid.js';
import QuestionSettingsModal, { QUESTION_TYPE_META } from '../components/QuestionSettingsModal.jsx';
import LoadCategoriesModal from '../components/LoadCategoriesModal.jsx';
import LoadBankModal from '../components/LoadBankModal.jsx';
import AIGenerateModal from '../components/AIGenerateModal.jsx';
import QuestionEditor from '../components/QuestionEditor.jsx';

// Map a Question Bank record into the Builder's local question shape.
function bankToLocal(q) {
  return {
    _localId: uid('q'),
    text: q.text,
    type: q.type,
    options: q.options || [],
    ratingScale: q.ratingScale || 5,
    correctAnswer: q.correctAnswer ?? null,
    points: q.points ?? 1,
    tolerance: q.tolerance ?? 0,
    pairs: q.pairs || [],
    accept: q.accept || '',
  };
}

// Build blank question slots from the type/count map chosen in the settings popup.
function buildQuestions(counts) {
  const questions = [];
  for (const [type, count] of Object.entries(counts)) {
    const meta = QUESTION_TYPE_META[type] || {};
    for (let i = 0; i < count; i += 1) {
      questions.push({
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
      });
    }
  }
  return questions;
}

const emptyState = { title: '', description: '', passingScore: 60, timeLimitMinutes: 0, categories: [] };

export default function Builder() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyState);
  const [expanded, setExpanded] = useState(new Set());
  const [settingsFor, setSettingsFor] = useState(null); // { catId, factorId, factorName }
  const [bankFor, setBankFor] = useState(null); // { catId, factorId, factorName }
  const [aiFor, setAiFor] = useState(null); // { catId, factorId, factorName }
  const [aiEnabled, setAiEnabled] = useState(false);
  const [drag, setDrag] = useState(null); // { type, catId, factorId, index }
  const [showLoad, setShowLoad] = useState(false);

  // Only show the "Generate with AI" button if the server has a Claude key.
  useEffect(() => {
    api.get('/ai/status').then((res) => setAiEnabled(res.data.enabled)).catch(() => setAiEnabled(false));
  }, []);
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

  // ---- drag & drop reordering (Module 9) ----
  // `drag` describes what's being dragged: { type, catId, factorId, index }.
  const move = (arr, from, to) => {
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  // Drop handlers only reorder when the dragged item shares the target's list.
  const dropOnCategory = (toIndex) => {
    if (drag?.type !== 'category') return;
    setCategories(move(draft.categories, drag.index, toIndex));
    setDrag(null);
  };
  const dropOnFactor = (catId, toIndex) => {
    if (drag?.type !== 'factor' || drag.catId !== catId) return;
    updateCategory(catId, (cat) => ({ ...cat, factors: move(cat.factors, drag.index, toIndex) }));
    setDrag(null);
  };
  const dropOnQuestion = (catId, factorId, toIndex) => {
    if (drag?.type !== 'question' || drag.catId !== catId || drag.factorId !== factorId) return;
    updateFactor(catId, factorId, (f) => ({ ...f, questions: move(f.questions, drag.index, toIndex) }));
    setDrag(null);
  };

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

  // Append questions pulled from the Question Bank into the target factor.
  const applyBankQuestions = (bankQs) => {
    const { catId, factorId } = bankFor;
    const mapped = bankQs.map(bankToLocal);
    updateFactor(catId, factorId, (f) => ({ ...f, questions: [...f.questions, ...mapped] }));
    setBankFor(null);
  };

  // Append AI-generated questions (same shape as bank records) into the factor.
  const applyAiQuestions = (aiQs) => {
    const { catId, factorId } = aiFor;
    const mapped = aiQs.map(bankToLocal);
    updateFactor(catId, factorId, (f) => ({ ...f, questions: [...f.questions, ...mapped] }));
    setAiFor(null);
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
          correctAnswer: q.correctAnswer ?? null,
          points: q.points ?? 1,
          tolerance: q.tolerance ?? 0,
          pairs: q.pairs || [],
          accept: q.accept || '',
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
    passingScore: Number(draft.passingScore) || 0,
    timeLimitMinutes: Number(draft.timeLimitMinutes) || 0,
    categories: draft.categories.map((c) => ({
      name: c.name.trim(),
      factors: c.factors.map((f) => ({
        name: f.name.trim(),
        questions: f.questions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          options: (q.options || []).filter((o) => o.trim() !== ''),
          ratingScale: q.ratingScale,
          correctAnswer: q.correctAnswer ?? null,
          points: Number(q.points) || 1,
          tolerance: Number(q.tolerance) || 0,
          pairs: (q.pairs || []).filter((p) => p.left.trim() !== '' && p.right.trim() !== ''),
          accept: q.accept || '',
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
        <label>
          Passing score (%)
          <input
            type="number"
            min="0"
            max="100"
            value={draft.passingScore}
            onChange={(e) => setDraft({ ...draft, passingScore: e.target.value })}
          />
        </label>
        <label>
          Time limit (minutes, 0 = none)
          <input
            type="number"
            min="0"
            value={draft.timeLimitMinutes}
            onChange={(e) => setDraft({ ...draft, timeLimitMinutes: e.target.value })}
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
      {draft.categories.map((cat, catIndex) => (
        <div
          className="accordion accordion-category"
          key={cat._localId}
          onDragOver={(e) => drag?.type === 'category' && e.preventDefault()}
          onDrop={() => dropOnCategory(catIndex)}
        >
          <div className="accordion-head">
            <span
              className="drag-handle"
              draggable
              onDragStart={() => setDrag({ type: 'category', index: catIndex })}
              title="Drag to reorder category"
            >
              ⠿
            </span>
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
              {cat.factors.map((factor, factorIndex) => (
                <div
                  className="accordion accordion-factor"
                  key={factor._localId}
                  onDragOver={(e) =>
                    drag?.type === 'factor' && drag.catId === cat._localId && e.preventDefault()
                  }
                  onDrop={() => dropOnFactor(cat._localId, factorIndex)}
                >
                  <div className="accordion-head">
                    <span
                      className="drag-handle"
                      draggable
                      onDragStart={() =>
                        setDrag({ type: 'factor', catId: cat._localId, index: factorIndex })
                      }
                      title="Drag to reorder factor"
                    >
                      ⠿
                    </span>
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
                        <div
                          key={q._localId}
                          onDragOver={(e) =>
                            drag?.type === 'question' &&
                            drag.catId === cat._localId &&
                            drag.factorId === factor._localId &&
                            e.preventDefault()
                          }
                          onDrop={() => dropOnQuestion(cat._localId, factor._localId, idx)}
                        >
                          <QuestionEditor
                            question={q}
                            index={idx}
                            onChange={(updated) => updateQuestion(cat._localId, factor._localId, updated)}
                            onRemove={() => removeQuestion(cat._localId, factor._localId, q._localId)}
                            onDragStart={() =>
                              setDrag({
                                type: 'question',
                                catId: cat._localId,
                                factorId: factor._localId,
                                index: idx,
                              })
                            }
                          />
                        </div>
                      ))}
                      <div className="factor-actions">
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
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setBankFor({
                              catId: cat._localId,
                              factorId: factor._localId,
                              factorName: factor.name,
                            })
                          }
                        >
                          🏦 Add from Bank
                        </button>
                        {aiEnabled && (
                          <button
                            className="btn btn-ai btn-sm"
                            onClick={() =>
                              setAiFor({
                                catId: cat._localId,
                                factorId: factor._localId,
                                factorName: factor.name,
                              })
                            }
                          >
                            ✨ Generate with AI
                          </button>
                        )}
                      </div>
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

      {bankFor && (
        <LoadBankModal
          factorName={bankFor.factorName}
          onAdd={applyBankQuestions}
          onClose={() => setBankFor(null)}
        />
      )}

      {aiFor && (
        <AIGenerateModal
          factorName={aiFor.factorName}
          onAdd={applyAiQuestions}
          onClose={() => setAiFor(null)}
        />
      )}
    </div>
  );
}
