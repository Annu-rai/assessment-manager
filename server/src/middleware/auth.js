import asyncHandler from 'express-async-handler';
import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';

/**
 * Protect routes: require a valid `Authorization: Bearer <token>` header and
 * attach the authenticated user to req.user.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401);
    throw new Error('Not authorized: missing token');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401);
    throw new Error('Not authorized: invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    res.status(401);
    throw new Error('Not authorized: user no longer exists');
  }

  req.user = user;
  next();
});
