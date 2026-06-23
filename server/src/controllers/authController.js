import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import { signToken } from '../utils/token.js';

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409);
    throw new Error('An account with that email already exists');
  }

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  const token = signToken(user.id);
  res.status(201).json({ user, token });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const token = signToken(user.id);
  res.json({ user, token });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
