/**
 * Scoring engine (foundation for analytics, pass %, certificates, ranking).
 *
 * Given an assessment's embedded question tree and a set of submitted answers,
 * grade each answer against its `correctAnswer` and produce an aggregate result.
 * Ungraded (survey-style) questions — those with no correctAnswer — contribute
 * nothing to the score and are recorded with isCorrect = null.
 */

// Normalise a value for comparison: trim strings, lowercase, so "React" === "react ".
function norm(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : v;
}

// Compare a submitted answer against the question's correctAnswer.
// Returns true/false for graded questions, or null if the question is ungraded.
export function gradeAnswer(question, submitted) {
  const correct = question.correctAnswer;

  // match is graded from `pairs`, not correctAnswer.
  if (question.type === 'match') {
    const pairs = (question.pairs || []).filter((p) => p.left !== '' && p.right !== '');
    if (pairs.length === 0) return null;
    // submitted is an object mapping left -> chosen right.
    const map = submitted && typeof submitted === 'object' ? submitted : {};
    return pairs.every((p) => norm(map[p.left]) === norm(p.right));
  }

  if (correct === null || correct === undefined || correct === '') return null;

  if (question.type === 'multiple_choice') {
    // Both are arrays of option strings; order-independent set equality.
    const want = (Array.isArray(correct) ? correct : [correct]).map(norm).sort();
    const got = (Array.isArray(submitted) ? submitted : [submitted]).map(norm).sort();
    return want.length === got.length && want.every((v, i) => v === got[i]);
  }

  if (question.type === 'boolean') {
    return norm(String(submitted)) === norm(String(correct));
  }

  if (question.type === 'numerical') {
    const a = Number(submitted);
    const b = Number(correct);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return Math.abs(a - b) <= (question.tolerance || 0);
  }

  if (question.type === 'fill_blank') {
    // correctAnswer may be a single string or a list of acceptable answers.
    const acceptable = (Array.isArray(correct) ? correct : [correct]).map(norm);
    return acceptable.includes(norm(submitted));
  }

  // single_choice, and any other scalar: normalised equality.
  return norm(submitted) === norm(correct);
}

/**
 * Walk the assessment tree, index questions by id, and grade a list of raw
 * answers ({ questionId, answer }). Returns { answers, graded, score, maxScore,
 * percentage, passed } ready to persist on a Response.
 *
 * @param {object} assessment - Assessment doc (with embedded categories)
 * @param {Array}  rawAnswers - [{ questionId, answer }]
 */
export function scoreResponse(assessment, rawAnswers) {
  // Build a lookup of questionId -> { question, categoryName, factorName }.
  const index = new Map();
  for (const cat of assessment.categories || []) {
    for (const factor of cat.factors || []) {
      for (const q of factor.questions || []) {
        index.set(String(q._id), { q, categoryName: cat.name, factorName: factor.name });
      }
    }
  }

  const answers = [];
  let score = 0;
  let maxScore = 0;
  let anyGraded = false;

  for (const raw of rawAnswers || []) {
    const entry = index.get(String(raw.questionId));
    if (!entry) continue; // ignore answers to questions not in this assessment
    const { q, categoryName, factorName } = entry;

    const isCorrect = gradeAnswer(q, raw.answer);
    let pointsAwarded = 0;
    let pointsPossible = 0;

    if (isCorrect !== null) {
      anyGraded = true;
      pointsPossible = q.points ?? 1;
      pointsAwarded = isCorrect ? pointsPossible : 0;
      score += pointsAwarded;
      maxScore += pointsPossible;
    }

    answers.push({
      questionId: q._id,
      categoryName,
      factorName,
      questionText: q.text,
      type: q.type,
      answer: raw.answer,
      isCorrect,
      pointsAwarded,
      pointsPossible,
    });
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = anyGraded ? percentage >= (assessment.passingScore ?? 60) : null;

  return { answers, graded: anyGraded, score, maxScore, percentage, passed };
}
