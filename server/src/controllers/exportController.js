import asyncHandler from 'express-async-handler';
import Response from '../models/Response.js';
import User from '../models/User.js';
import { orgFilter } from '../middleware/rbac.js';
import { sendExport } from '../utils/exporters.js';

// Human-friendly role labels for exports.
const labelRole = (r) =>
  ({
    super_admin: 'Super Admin',
    org_admin: 'Org Admin',
    recruiter: 'Recruiter',
    interviewer: 'Interviewer',
    trainer: 'Trainer',
    candidate: 'Candidate',
  }[r] || r);

const fmt = (req) => String(req.query.format || 'csv').toLowerCase();
const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');

// GET /api/export/responses?format=csv|xlsx|pdf — all submissions in the org.
export const exportResponses = asyncHandler(async (req, res) => {
  const docs = await Response.find(orgFilter(req))
    .populate('respondent', 'name email')
    .populate('assessment', 'title')
    .sort('-createdAt')
    .lean();

  const columns = [
    { key: 'candidate', label: 'Candidate', width: 22 },
    { key: 'email', label: 'Email', width: 26 },
    { key: 'assessment', label: 'Assessment', width: 26 },
    { key: 'score', label: 'Score', width: 10 },
    { key: 'maxScore', label: 'Max', width: 10 },
    { key: 'percentage', label: 'Percent', width: 10 },
    { key: 'passed', label: 'Passed', width: 10 },
    { key: 'submittedAt', label: 'Submitted', width: 22 },
  ];

  const rows = docs.map((r) => ({
    candidate: r.respondent?.name || 'Unknown',
    email: r.respondent?.email || '',
    assessment: r.assessment?.title || 'Untitled',
    score: r.score,
    maxScore: r.maxScore,
    percentage: r.graded ? `${r.percentage}%` : '—',
    passed: r.graded ? yesNo(r.passed) : '—',
    submittedAt: new Date(r.createdAt).toLocaleString(),
  }));

  await sendExport(res, fmt(req), {
    columns,
    rows,
    basename: 'responses',
    sheetName: 'Responses',
    title: 'Assessment Responses',
  });
});

// GET /api/export/candidates?format=csv|xlsx|pdf — org members (Team).
export const exportCandidates = asyncHandler(async (req, res) => {
  const docs = await User.find(orgFilter(req)).sort('-createdAt').lean();

  const columns = [
    { key: 'name', label: 'Name', width: 22 },
    { key: 'email', label: 'Email', width: 28 },
    { key: 'role', label: 'Role', width: 16 },
    { key: 'status', label: 'Status', width: 12 },
    { key: 'joined', label: 'Joined', width: 22 },
  ];

  const rows = docs.map((u) => ({
    name: u.name,
    email: u.email,
    role: labelRole(u.role),
    status: u.isActive === false ? 'Inactive' : 'Active',
    joined: new Date(u.createdAt).toLocaleDateString(),
  }));

  await sendExport(res, fmt(req), {
    columns,
    rows,
    basename: 'members',
    sheetName: 'Members',
    title: 'Organization Members',
  });
});
