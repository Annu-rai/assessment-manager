import asyncHandler from 'express-async-handler';
import crypto from 'node:crypto';
import Assessment from '../models/Assessment.js';
import Category from '../models/Category.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';
import { sendMail, isEmailConfigured } from '../utils/email.js';
import { auditReq } from '../utils/audit.js';

const isCandidate = (req) => req.user.role === ROLES.CANDIDATE;

/**
 * Return an assessment as a plain object with every question's `correctAnswer`
 * removed, so candidates taking the test can't see the answer key.
 */
export function stripAnswerKey(assessment) {
  const obj = assessment.toObject ? assessment.toObject() : assessment;
  for (const cat of obj.categories || []) {
    for (const factor of cat.factors || []) {
      for (const q of factor.questions || []) {
        delete q.correctAnswer;
      }
    }
  }
  return obj;
}

// GET /api/assessments — staff see the whole org's assessments; candidates see
// only the published assessments assigned to them.
export const listAssessments = asyncHandler(async (req, res) => {
  const filter = orgFilter(req);
  if (isCandidate(req)) {
    filter.assignedTo = req.user.id;
    filter.status = 'published';
  }
  const assessments = await Assessment.find(filter).sort('-createdAt');
  res.json(assessments);
});

// GET /api/assessments/:id — full assessment tree (answer key hidden from candidates)
export const getAssessment = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, ...orgFilter(req) };
  if (isCandidate(req)) {
    filter.assignedTo = req.user.id;
    filter.status = 'published';
  }
  const assessment = await Assessment.findOne(filter);
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  res.json(isCandidate(req) ? stripAnswerKey(assessment) : assessment);
});

/**
 * POST /api/assessments — save a built assessment (staff only).
 * Embeds the category tree as a snapshot AND mirrors each category into the
 * reusable, org-shared Category template library.
 */
export const createAssessment = asyncHandler(async (req, res) => {
  const {
    title,
    description = '',
    categories = [],
    passingScore = 60,
    timeLimitMinutes = 0,
    status = 'published',
    assignedTo = [],
  } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400);
    throw new Error('An assessment needs at least one category');
  }

  const assessment = await Assessment.create({
    title,
    description,
    categories,
    passingScore,
    timeLimitMinutes,
    status,
    assignedTo,
    owner: req.user.id,
    organization: req.user.organization,
  });

  // Mirror categories into the reusable library (best-effort, non-fatal).
  try {
    await Promise.all(
      categories.map((cat) =>
        Category.create({
          name: cat.name,
          factors: cat.factors || [],
          owner: req.user.id,
          organization: req.user.organization,
        })
      )
    );
  } catch (err) {
    console.warn('Could not mirror categories to template library:', err.message);
  }

  auditReq(req, 'assessment.create', assessment.title);
  res.status(201).json(assessment);
});

// PUT /api/assessments/:id — update settings / assign candidates (staff only)
export const updateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  const fields = ['title', 'description', 'passingScore', 'timeLimitMinutes', 'status', 'assignedTo'];
  for (const f of fields) {
    if (req.body[f] !== undefined) assessment[f] = req.body[f];
  }
  await assessment.save();
  res.json(assessment);
});

/**
 * POST /api/assessments/:id/public-link — enable/disable a public share link
 * (Module 14). Enabling generates a stable publicId if one doesn't exist.
 * Body: { enabled: boolean }.
 */
export const setPublicLink = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  const enabled = req.body.enabled !== false; // default to enabling
  assessment.isPublic = enabled;
  if (enabled && !assessment.publicId) {
    assessment.publicId = crypto.randomBytes(9).toString('base64url'); // ~12 chars, URL-safe
  }
  await assessment.save();
  res.json({ isPublic: assessment.isPublic, publicId: assessment.publicId });
});

/**
 * POST /api/assessments/:id/invite — email candidates a link to take this
 * assessment (Module 13). Ensures a public link exists, then emails each address.
 * Body: { emails: [string] }.
 */
export const inviteCandidates = asyncHandler(async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    res.status(400);
    throw new Error('Provide at least one email address');
  }

  const assessment = await Assessment.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }

  // Ensure a public link exists so invitees can take it without an account.
  if (!assessment.isPublic || !assessment.publicId) {
    assessment.isPublic = true;
    if (!assessment.publicId) assessment.publicId = crypto.randomBytes(9).toString('base64url');
    await assessment.save();
  }

  const base = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() ||
    `${req.protocol}://${req.get('host')}`;
  const link = `${base}/t/${assessment.publicId}`;

  const sent = [];
  const failed = [];
  for (const email of emails) {
    try {
      await sendMail({
        to: email,
        subject: `You're invited to take "${assessment.title}"`,
        text: `You have been invited to take the assessment "${assessment.title}".\n\nStart here: ${link}`,
        html: `<p>You have been invited to take the assessment <strong>${assessment.title}</strong>.</p>
               <p><a href="${link}">Start the assessment</a></p>`,
      });
      sent.push(email);
    } catch (err) {
      failed.push({ email, error: err.message });
    }
  }

  auditReq(req, 'assessment.invite', assessment.title, { count: sent.length });
  res.json({ link, sent, failed, delivered: isEmailConfigured() });
});

// DELETE /api/assessments/:id (staff only)
export const deleteAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  auditReq(req, 'assessment.delete', assessment.title);
  res.json({ message: 'Assessment deleted' });
});
