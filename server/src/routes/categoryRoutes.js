import { Router } from 'express';
import { body } from 'express-validator';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect); // all category routes require auth

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
