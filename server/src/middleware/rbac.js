/**
 * Role-Based Access Control middleware (Module 2).
 *
 * Use after `protect` (which attaches req.user). `authorize(...roles)` restricts
 * a route to the listed roles; super_admin always passes.
 */
import { ROLES } from '../config/roles.js';

export function authorize(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized: no user'));
    }
    if (req.user.role === ROLES.SUPER_ADMIN || allowed.includes(req.user.role)) {
      return next();
    }
    res.status(403);
    return next(new Error('Forbidden: insufficient role'));
  };
}

/**
 * Returns the base query filter that scopes documents to the caller's org.
 * super_admin gets an empty filter (sees everything across orgs).
 */
export function orgFilter(req) {
  if (req.user.role === ROLES.SUPER_ADMIN) return {};
  return { organization: req.user.organization };
}
