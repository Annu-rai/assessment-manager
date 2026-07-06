import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES, ROLE_VALUES } from '../config/roles.js';
import { auditReq } from '../utils/audit.js';

// GET /api/users — list users in the caller's org (admins). super_admin sees all.
export const listUsers = asyncHandler(async (req, res) => {
  const filter = orgFilter(req);
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).sort('-createdAt');
  res.json(users);
});

/**
 * POST /api/users — create a user inside the caller's organization (admins).
 * Used to add recruiters, interviewers, trainers and candidates. The new user's
 * role must be a valid non-super_admin role (only super_admin can mint another).
 */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = ROLES.CANDIDATE } = req.body;

  if (!ROLE_VALUES.includes(role)) {
    res.status(400);
    throw new Error('Invalid role');
  }
  if (role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    res.status(403);
    throw new Error('Only a super admin can create another super admin');
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409);
    throw new Error('An account with that email already exists');
  }

  const user = new User({
    name,
    email,
    role,
    organization: req.user.organization,
  });
  await user.setPassword(password);
  await user.save();

  auditReq(req, 'user.create', user.email, { role });
  res.status(201).json(user);
});

// PUT /api/users/:id — change a user's role or active status (admins, same org)
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.role !== undefined) {
    if (!ROLE_VALUES.includes(req.body.role)) {
      res.status(400);
      throw new Error('Invalid role');
    }
    user.role = req.body.role;
  }
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  await user.save();

  auditReq(req, 'user.update', user.email, { role: user.role, isActive: user.isActive });
  res.json(user);
});

// DELETE /api/users/:id — deactivate a user (soft delete keeps their responses)
export const deactivateUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    res.status(400);
    throw new Error('You cannot deactivate your own account');
  }
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, ...orgFilter(req) },
    { isActive: false },
    { new: true }
  );
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  auditReq(req, 'user.deactivate', user.email);
  res.json({ message: 'User deactivated', user });
});
