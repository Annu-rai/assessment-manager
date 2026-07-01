import asyncHandler from 'express-async-handler';
import { isAIEnabled, AI_MODEL } from '../config/anthropic.js';
import { generateQuestions, AI_QUESTION_TYPES } from '../utils/aiQuestionGenerator.js';
import { evaluateEssays } from '../utils/aiEvaluator.js';
import Response from '../models/Response.js';
import Assessment from '../models/Assessment.js';
import { orgFilter } from '../middleware/rbac.js';

// Translate an Anthropic/API error into a clean HTTP status + message.
function aiError(res, err) {
  const status = err.status || err.statusCode;
  if (status === 401) {
    res.status(502);
    return new Error('AI provider rejected the API key. Check ANTHROPIC_API_KEY.');
  }
  if (status === 429) {
    res.status(429);
    return new Error('AI provider is rate-limited. Please try again in a moment.');
  }
  res.status(status && status >= 400 && status < 600 ? status : 502);
  return new Error(err.message || 'AI request failed');
}

// GET /api/ai/status — lets the client show/hide AI features gracefully.
export const aiStatus = asyncHandler(async (req, res) => {
  res.json({ enabled: isAIEnabled(), model: isAIEnabled() ? AI_MODEL : null, types: AI_QUESTION_TYPES });
});

/**
 * POST /api/ai/generate-questions — generate questions with Claude (staff only).
 * Body: { topic, count, types, difficulty }. Returns { questions } in the
 * Builder's question shape so the client can drop them straight into a factor.
 */
export const generate = asyncHandler(async (req, res) => {
  const { topic, count, types, difficulty } = req.body;

  if (!isAIEnabled()) {
    res.status(503);
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable it.');
  }

  try {
    const questions = await generateQuestions({ topic, count, types, difficulty });
    res.json({ questions });
  } catch (err) {
    throw aiError(res, err);
  }
});

/**
 * POST /api/ai/evaluate-response/:id — AI-grade the essay answers in a
 * submission (Module 6), then recompute the aggregate score to include them.
 */
export const evaluateResponse = asyncHandler(async (req, res) => {
  if (!isAIEnabled()) {
    res.status(503);
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable it.');
  }

  const response = await Response.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!response) {
    res.status(404);
    throw new Error('Response not found');
  }

  const assessment = await Assessment.findById(response.assessment);
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment for this response no longer exists');
  }

  // Index the assessment's questions so we know each essay's points + text.
  const qIndex = new Map();
  for (const cat of assessment.categories || []) {
    for (const factor of cat.factors || []) {
      for (const q of factor.questions || []) {
        qIndex.set(String(q._id), q);
      }
    }
  }

  // Collect essay answers that need grading (remember their position in answers[]).
  const items = [];
  const answerRefs = [];
  response.answers.forEach((a, i) => {
    const q = qIndex.get(String(a.questionId));
    if (q && q.type === 'essay') {
      items.push({ question: q.text, answer: String(a.answer ?? ''), maxPoints: q.points ?? 1 });
      answerRefs.push({ i, maxPoints: q.points ?? 1 });
    }
  });

  if (items.length === 0) {
    res.status(400);
    throw new Error('This submission has no essay answers to grade');
  }

  let evaluations;
  try {
    evaluations = await evaluateEssays(items);
  } catch (err) {
    throw aiError(res, err);
  }

  // Apply each evaluation back onto the stored answer.
  for (const ev of evaluations) {
    const ref = answerRefs[ev.index];
    if (!ref) continue;
    const a = response.answers[ref.i];
    a.aiGraded = true;
    a.aiScore = ev.score;
    a.aiFeedback = ev.feedback;
    a.pointsAwarded = ev.score;
    a.pointsPossible = ref.maxPoints;
  }

  // Recompute the aggregate over every answer (auto-graded + AI-graded).
  let score = 0;
  let maxScore = 0;
  for (const a of response.answers) {
    score += a.pointsAwarded || 0;
    maxScore += a.pointsPossible || 0;
  }
  response.score = score;
  response.maxScore = maxScore;
  response.graded = maxScore > 0;
  response.percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  response.passed = response.graded ? response.percentage >= (assessment.passingScore ?? 60) : null;
  response.aiEvaluatedAt = new Date();

  await response.save();
  res.json(response);
});
