import { Router } from 'express';
import { body } from 'express-validator';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { ADMIN_ROLES } from '../config/roles.js';

const router = Router();

// All user-management routes require an org admin (or super admin).
router.use(protect, authorize(...ADMIN_ROLES));

router.get('/', listUsers);
router.post(
  '/',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate,
  createUser
);
router.put('/:id', updateUser);
router.delete('/:id', deactivateUser);

export default router;
