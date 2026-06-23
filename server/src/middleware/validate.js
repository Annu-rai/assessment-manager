import { validationResult } from 'express-validator';

// Run after express-validator checks; turns accumulated errors into a 400.
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400);
    return next(new Error(errors.array().map((e) => e.msg).join(', ')));
  }
  next();
}
