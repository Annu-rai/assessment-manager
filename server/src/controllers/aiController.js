import asyncHandler from 'express-async-handler';
import { isAIEnabled, AI_MODEL } from '../config/anthropic.js';
import { generateQuestions, AI_QUESTION_TYPES } from '../utils/aiQuestionGenerator.js';
import { evaluateEssays } from '../utils/aiEvaluator.js';
import { generateInsights } from '../utils/aiInsights.js';
import { runChat } from '../utils/aiChat.js';
import { generateRecommendation } from '../utils/aiRecommendation.js';
import { maybeIssueCertificate } from '../utils/certificateService.js';
import Response from '../models/Response.js';
import Assessment from '../models/Assessment.js';
import User from '../models/User.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';

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

  // AI grading can flip a submission to passing — issue a certificate if so.
  try {
    const candidate = await User.findById(response.respondent);
    if (candidate) await maybeIssueCertificate({ response, assessment, user: candidate });
  } catch (e) {
    console.warn('Certificate issue failed:', e.message);
  }

  res.json(response);
});

/**
 * GET /api/ai/insights — compute org analytics, then have Claude turn the
 * numbers into plain-English insights + recommendations (Module 16).
 */
export const insights = asyncHandler(async (req, res) => {
  if (!isAIEnabled()) {
    res.status(503);
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable it.');
  }

  const scope = orgFilter(req);
  const [responses, candidates] = await Promise.all([
    Response.find(scope).populate('assessment', 'title').lean(),
    User.countDocuments({ ...scope, role: ROLES.CANDIDATE }),
  ]);

  if (responses.length === 0) {
    res.status(400);
    throw new Error('No submission data yet to analyze.');
  }

  const graded = responses.filter((r) => r.graded);
  const passRate = graded.length
    ? Math.round((graded.filter((r) => r.passed).length / graded.length) * 100)
    : 0;
  const averageScore = graded.length
    ? Math.round(graded.reduce((s, r) => s + r.percentage, 0) / graded.length)
    : 0;

  // Per-category performance (weak topics = low avg %).
  const catTally = new Map();
  const asmtTally = new Map();
  for (const r of responses) {
    for (const a of r.answers || []) {
      if ((a.pointsPossible || 0) > 0) {
        const c = catTally.get(a.categoryName) || { awarded: 0, possible: 0, answers: 0 };
        c.awarded += a.pointsAwarded || 0;
        c.possible += a.pointsPossible || 0;
        c.answers += 1;
        catTally.set(a.categoryName, c);
      }
    }
    if (r.graded) {
      const title = r.assessment?.title || 'Untitled';
      const t = asmtTally.get(title) || { total: 0, attempts: 0 };
      t.total += r.percentage;
      t.attempts += 1;
      asmtTally.set(title, t);
    }
  }

  const categories = [...catTally.entries()]
    .map(([name, v]) => ({
      name,
      avgPercent: v.possible ? Math.round((v.awarded / v.possible) * 100) : 0,
      answers: v.answers,
    }))
    .sort((a, b) => a.avgPercent - b.avgPercent);

  const assessments = [...asmtTally.entries()].map(([title, v]) => ({
    title,
    avgPercent: Math.round(v.total / v.attempts),
    attempts: v.attempts,
  }));

  const stats = {
    totalSubmissions: responses.length,
    gradedSubmissions: graded.length,
    passRate,
    averageScore,
    candidates,
    weakestCategories: categories.slice(0, 5),
    strongestCategories: categories.slice(-3).reverse(),
    assessments,
  };

  try {
    const result = await generateInsights(stats);
    res.json({ stats, ...result });
  } catch (err) {
    throw aiError(res, err);
  }
});

/**
 * POST /api/ai/chat — natural-language assistant over the org's data (Module 32).
 * Body: { messages: [{ role, content }] }. Returns { reply }.
 */
export const chat = asyncHandler(async (req, res) => {
  if (!isAIEnabled()) {
    res.status(503);
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable it.');
  }
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400);
    throw new Error('messages must be a non-empty array');
  }
  try {
    const reply = await runChat(messages, orgFilter(req));
    res.json({ reply });
  } catch (err) {
    throw aiError(res, err);
  }
});

/**
 * GET /api/ai/recommendation/:candidateId — role-fit recommendation for a
 * candidate based on their assessment performance (Module 38, staff only).
 */
export const recommendation = asyncHandler(async (req, res) => {
  if (!isAIEnabled()) {
    res.status(503);
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY on the server to enable it.');
  }

  const candidate = await User.findOne({ _id: req.params.candidateId, ...orgFilter(req) });
  if (!candidate) {
    res.status(404);
    throw new Error('Candidate not found');
  }

  const responses = await Response.find({ ...orgFilter(req), respondent: candidate._id })
    .populate('assessment', 'title')
    .lean();

  if (responses.length === 0) {
    res.status(400);
    throw new Error('This candidate has no assessment submissions to analyze');
  }

  // Per-category performance + per-assessment scores.
  const catTally = new Map();
  const assessments = [];
  let gradedTotal = 0;
  let gradedCount = 0;
  for (const r of responses) {
    for (const a of r.answers || []) {
      if ((a.pointsPossible || 0) > 0) {
        const c = catTally.get(a.categoryName) || { awarded: 0, possible: 0 };
        c.awarded += a.pointsAwarded || 0;
        c.possible += a.pointsPossible || 0;
        catTally.set(a.categoryName, c);
      }
    }
    if (r.graded) {
      gradedTotal += r.percentage;
      gradedCount += 1;
      assessments.push({ title: r.assessment?.title || 'Untitled', percentage: r.percentage, passed: r.passed });
    }
  }

  const stats = {
    candidateName: candidate.name,
    overallAverage: gradedCount ? Math.round(gradedTotal / gradedCount) : null,
    assessmentsTaken: responses.length,
    categories: [...catTally.entries()].map(([name, v]) => ({
      name,
      avgPercent: v.possible ? Math.round((v.awarded / v.possible) * 100) : 0,
    })),
    assessments,
  };

  try {
    const result = await generateRecommendation(stats);
    res.json({ candidate: candidate.name, stats, ...result });
  } catch (err) {
    throw aiError(res, err);
  }
});
