import { Router } from 'express';
import { body } from 'express-validator';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../config/roles.js';

const router = Router();

// Category templates are a Builder concept — staff only, scoped to the org.
router.use(protect, authorize(...STAFF_ROLES));

router.get('/', listCategories);
router.post(
  '/',
  body('name').trim().notEmpty().withMessage('Category name is required'),
  validate,
  createCategory
);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
