import { Router } from 'express';
import { body } from 'express-validator';
import {
  listQuestions,
  randomQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

// The Question Bank is a staff tool, scoped to the org.
router.use(protect, authorize(...STAFF_ROLES));

router.get('/', listQuestions);
router.get('/random', randomQuestions);
router.post(
  '/',
  body('text').trim().notEmpty().withMessage('Question text is required'),
  body('type').notEmpty().withMessage('Question type is required'),
  validate,
  createQuestion
);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
