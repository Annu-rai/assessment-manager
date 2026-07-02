import { Router } from 'express';
import { body } from 'express-validator';
import { aiStatus, generate, evaluateResponse, insights, chat } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

// AI tools are staff-only.
router.use(protect, authorize(...STAFF_ROLES));

router.get('/status', aiStatus);
router.post(
  '/generate-questions',
  body('topic').trim().notEmpty().withMessage('A topic is required'),
  validate,
  generate
);
router.post('/evaluate-response/:id', evaluateResponse);
router.get('/insights', insights);
router.post('/chat', chat);

export default router;
