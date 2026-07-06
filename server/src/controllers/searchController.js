import asyncHandler from 'express-async-handler';
import Assessment from '../models/Assessment.js';
import User from '../models/User.js';
import Question from '../models/Question.js';
import { orgFilter } from '../middleware/rbac.js';

// Escape user input before using it in a RegExp.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/search?q= — global search across assessments, members, and bank
// questions (Module 27). Org-scoped, staff only.
export const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ assessments: [], users: [], questions: [] });

  const rx = new RegExp(escapeRe(q), 'i');
  const scope = orgFilter(req);

  const [assessments, users, questions] = await Promise.all([
    Assessment.find({ ...scope, title: rx }).select('title status').limit(10).lean(),
    User.find({ ...scope, $or: [{ name: rx }, { email: rx }] })
      .select('name email role')
      .limit(10)
      .lean(),
    Question.find({ ...scope, text: rx }).select('text type difficulty').limit(10).lean(),
  ]);

  res.json({ assessments, users, questions });
});
