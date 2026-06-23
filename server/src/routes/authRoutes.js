import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post(
  '/register',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  register
);

router.post(
  '/login',
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  login
);

router.get('/me', protect, me);

export default router;
