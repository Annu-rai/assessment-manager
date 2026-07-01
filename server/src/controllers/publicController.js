import asyncHandler from 'express-async-handler';
import crypto from 'node:crypto';
import Assessment from '../models/Assessment.js';
import Response from '../models/Response.js';
import User from '../models/User.js';
import { stripAnswerKey } from './assessmentController.js';
import { scoreResponse } from '../utils/scoring.js';
import { ROLES } from '../config/roles.js';

// Look up a live public assessment by its share id.
async function findPublic(publicId) {
  return Assessment.findOne({ publicId, isPublic: true });
}

// GET /api/public/assessments/:publicId — fetch a public assessment (no auth).
// Answer key is stripped; only what a taker needs is returned.
export const getPublicAssessment = asyncHandler(async (req, res) => {
  const assessment = await findPublic(req.params.publicId);
  if (!assessment) {
    res.status(404);
    throw new Error('This assessment link is invalid or no longer active');
  }
  const safe = stripAnswerKey(assessment);
  res.json({
    _id: safe._id,
    title: safe.title,
    description: safe.description,
    categories: safe.categories,
    timeLimitMinutes: safe.timeLimitMinutes,
    publicId: assessment.publicId,
  });
});

/**
 * POST /api/public/assessments/:publicId/submit — anonymous submission.
 * Body: { name, email, answers }. We find-or-create a guest user (scoped to the
 * assessment's org) so the submission shows up in staff Reports/analytics.
 */
export const submitPublicResponse = asyncHandler(async (req, res) => {
  const { name, email, answers = [] } = req.body;
  const assessment = await findPublic(req.params.publicId);
  if (!assessment) {
    res.status(404);
    throw new Error('This assessment link is invalid or no longer active');
  }

  // Find-or-create the guest respondent in the assessment's organization.
  let respondent = null;
  if (email) {
    respondent = await User.findOne({ email: email.toLowerCase() });
  }
  if (!respondent) {
    respondent = new User({
      name: name || 'Guest',
      email: (email || `guest-${crypto.randomBytes(6).toString('hex')}@guest.local`).toLowerCase(),
      role: ROLES.CANDIDATE,
      organization: assessment.organization,
      isGuest: true,
      isActive: false,
    });
    await respondent.setPassword(crypto.randomBytes(16).toString('hex'));
    await respondent.save();
  }

  const result = scoreResponse(assessment, answers);
  if (result.answers.length === 0) {
    res.status(400);
    throw new Error('No valid answers were submitted');
  }

  const response = await Response.create({
    assessment: assessment._id,
    respondent: respondent._id,
    organization: assessment.organization,
    answers: result.answers,
    graded: result.graded,
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    passed: result.passed,
  });

  // Return just the taker-facing result summary.
  res.status(201).json({
    graded: response.graded,
    score: response.score,
    maxScore: response.maxScore,
    percentage: response.percentage,
    passed: response.passed,
  });
});
