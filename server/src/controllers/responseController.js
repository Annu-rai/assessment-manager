import asyncHandler from 'express-async-handler';
import Response from '../models/Response.js';
import Assessment from '../models/Assessment.js';

/**
 * POST /api/responses — submit answers for an assessment (Launch Pad).
 * Validates each answer's questionId against the assessment tree and
 * denormalises question metadata into the stored response.
 */
export const submitResponse = asyncHandler(async (req, res) => {
  const { assessmentId, answers = [] } = req.body;

  const assessment = await Assessment.findOne({ _id: assessmentId, owner: req.user.id });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  // Build a lookup of every question in the assessment for validation + metadata.
  const questionMap = new Map();
  for (const cat of assessment.categories) {
    for (const factor of cat.factors) {
      for (const q of factor.questions) {
        questionMap.set(String(q._id), {
          categoryName: cat.name,
          factorName: factor.name,
          questionText: q.text,
          type: q.type,
        });
      }
    }
  }

  const enriched = [];
  for (const a of answers) {
    const meta = questionMap.get(String(a.questionId));
    if (!meta) continue; // skip answers that don't belong to this assessment
    enriched.push({ questionId: a.questionId, answer: a.answer ?? null, ...meta });
  }

  if (enriched.length === 0) {
    res.status(400);
    throw new Error('No valid answers were submitted');
  }

  const response = await Response.create({
    assessment: assessmentId,
    respondent: req.user.id,
    answers: enriched,
  });

  res.status(201).json(response);
});

// GET /api/responses — list the user's submissions (for Reports)
export const listResponses = asyncHandler(async (req, res) => {
  const filter = { respondent: req.user.id };
  if (req.query.assessmentId) filter.assessment = req.query.assessmentId;

  const responses = await Response.find(filter)
    .populate('assessment', 'title')
    .sort('-createdAt');
  res.json(responses);
});

// GET /api/responses/:id — a single submission
export const getResponse = asyncHandler(async (req, res) => {
  const response = await Response.findOne({ _id: req.params.id, respondent: req.user.id })
    .populate('assessment', 'title');
  if (!response) {
    res.status(404);
    throw new Error('Response not found');
  }
  res.json(response);
});
