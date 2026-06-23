import { Router } from 'express';
import { body } from 'express-validator';
import {
  listAssessments,
  getAssessment,
  createAssessment,
  deleteAssessment,
} from '../controllers/assessmentController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/', listAssessments);
router.get('/:id', getAssessment);
router.post(
  '/',
  body('title').trim().notEmpty().withMessage('Assessment title is required'),
  validate,
  createAssessment
);
router.delete('/:id', deleteAssessment);

export default router;
