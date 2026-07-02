import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { signToken } from '../utils/token.js';
import { uniqueSlug } from '../utils/slug.js';
import { ROLES } from '../config/roles.js';

/**
 * POST /api/auth/register — self-serve signup.
 * Creates a brand-new Organization and makes the signer its Org Admin.
 * (Recruiters/candidates are added later from within the org, not here.)
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, organizationName } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409);
    throw new Error('An account with that email already exists');
  }

  const orgName = (organizationName || `${name}'s Organization`).trim();
  const org = await Organization.create({
    name: orgName,
    slug: await uniqueSlug(Organization, orgName),
  });

  const user = new User({
    name,
    email,
    organization: org._id,
    role: ROLES.ORG_ADMIN,
  });
  await user.setPassword(password);
  await user.save();

  const token = signToken(user.id);
  res.status(201).json({ user, organization: org, token });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  const token = signToken(user.id);
  res.json({ user, token });
});

// GET /api/auth/me — current user plus their organization
export const me = asyncHandler(async (req, res) => {
  let organization = null;
  if (req.user.organization) {
    organization = await Organization.findById(req.user.organization);
  }
  res.json({ user: req.user, organization });
});
