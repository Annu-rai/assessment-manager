import asyncHandler from 'express-async-handler';
import Response from '../models/Response.js';
import Assessment from '../models/Assessment.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';
import { scoreResponse } from '../utils/scoring.js';

const isCandidate = (req) => req.user.role === ROLES.CANDIDATE;

/**
 * POST /api/responses — submit answers for an assessment.
 * Validates each answer against the assessment tree, grades scored questions,
 * and stores the aggregate result (score / percentage / pass-fail).
 */
export const submitResponse = asyncHandler(async (req, res) => {
  const { assessmentId, answers = [] } = req.body;

  const filter = { _id: assessmentId, ...orgFilter(req) };
  if (isCandidate(req)) {
    filter.assignedTo = req.user.id;
    filter.status = 'published';
  }
  const assessment = await Assessment.findOne(filter);
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  // Grade + denormalise in one pass.
  const result = scoreResponse(assessment, answers);
  if (result.answers.length === 0) {
    res.status(400);
    throw new Error('No valid answers were submitted');
  }

  const response = await Response.create({
    assessment: assessmentId,
    respondent: req.user.id,
    organization: req.user.organization,
    answers: result.answers,
    graded: result.graded,
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    passed: result.passed,
  });

  res.status(201).json(response);
});

// GET /api/responses — staff see the org's submissions; candidates see their own.
export const listResponses = asyncHandler(async (req, res) => {
  const filter = orgFilter(req);
  if (isCandidate(req)) filter.respondent = req.user.id;
  if (req.query.assessmentId) filter.assessment = req.query.assessmentId;
  if (req.query.respondent && !isCandidate(req)) filter.respondent = req.query.respondent;

  const responses = await Response.find(filter)
    .populate('assessment', 'title passingScore')
    .populate('respondent', 'name email')
    .sort('-createdAt');
  res.json(responses);
});

// GET /api/responses/:id — a single submission (own for candidates, any-in-org for staff)
export const getResponse = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...orgFilter(req) };
  if (isCandidate(req)) filter.respondent = req.user.id;

  const response = await Response.findOne(filter)
    .populate('assessment', 'title passingScore')
    .populate('respondent', 'name email');
  if (!response) {
    res.status(404);
    throw new Error('Response not found');
  }
  res.json(response);
});
