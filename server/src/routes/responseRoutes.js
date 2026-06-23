import { Router } from 'express';
import { body } from 'express-validator';
import {
  submitResponse,
  listResponses,
  getResponse,
} from '../controllers/responseController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/', listResponses);
router.get('/:id', getResponse);
router.post(
  '/',
  body('assessmentId').notEmpty().withMessage('assessmentId is required'),
  body('answers').isArray({ min: 1 }).withMessage('answers must be a non-empty array'),
  validate,
  submitResponse
);

export default router;
