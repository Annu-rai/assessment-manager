import asyncHandler from 'express-async-handler';
import Organization from '../models/Organization.js';
import { ROLES } from '../config/roles.js';

// GET /api/organizations/me — the caller's organization (branding, plan, etc.)
export const getMyOrganization = asyncHandler(async (req, res) => {
  if (!req.user.organization) {
    res.status(404);
    throw new Error('You are not attached to an organization');
  }
  const org = await Organization.findById(req.user.organization);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  res.json(org);
});

// PUT /api/organizations/me — update branding / white-label settings (org admin)
export const updateMyOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.user.organization);
  if (!org) {
    res.status(404);
    throw new Error('Organization not found');
  }
  const fields = ['name', 'logoUrl', 'primaryColor'];
  for (const f of fields) {
    if (req.body[f] !== undefined) org[f] = req.body[f];
  }
  // Plan changes are platform-controlled (billing) — only super_admin may set them.
  if (req.body.plan !== undefined && req.user.role === ROLES.SUPER_ADMIN) {
    org.plan = req.body.plan;
  }
  await org.save();
  res.json(org);
});

// GET /api/organizations — list every organization (super admin / platform view)
export const listOrganizations = asyncHandler(async (req, res) => {
  const orgs = await Organization.find().sort('-createdAt');
  res.json(orgs);
});
