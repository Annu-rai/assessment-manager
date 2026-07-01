import { Router } from 'express';
import { body } from 'express-validator';
import {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  setPublicLink,
} from '../controllers/assessmentController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

router.use(protect);

// Reads are open to everyone in the org (candidates see only their assigned tests).
router.get('/', listAssessments);
router.get('/:id', getAssessment);

// Writes are staff-only.
router.post(
  '/',
  authorize(...STAFF_ROLES),
  body('title').trim().notEmpty().withMessage('Assessment title is required'),
  validate,
  createAssessment
);
router.put('/:id', authorize(...STAFF_ROLES), updateAssessment);
router.post('/:id/public-link', authorize(...STAFF_ROLES), setPublicLink);
router.delete('/:id', authorize(...STAFF_ROLES), deleteAssessment);

export default router;
