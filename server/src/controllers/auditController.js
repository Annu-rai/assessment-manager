import asyncHandler from 'express-async-handler';
import AuditLog from '../models/AuditLog.js';
import { orgFilter } from '../middleware/rbac.js';

// GET /api/audit — recent audit entries for the org (admins). Optional ?action= filter.
export const listAudit = asyncHandler(async (req, res) => {
  const filter = orgFilter(req);
  if (req.query.action) filter.action = req.query.action;
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 200));
  const logs = await AuditLog.find(filter).sort('-createdAt').limit(limit);
  res.json(logs);
});
