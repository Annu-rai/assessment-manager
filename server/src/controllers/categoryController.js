import asyncHandler from 'express-async-handler';
import Category from '../models/Category.js';
import { orgFilter } from '../middleware/rbac.js';

// GET /api/categories — reusable category templates shared across the org
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find(orgFilter(req)).sort('-updatedAt');
  res.json(categories);
});

// POST /api/categories — create a reusable category template
export const createCategory = asyncHandler(async (req, res) => {
  const { name, factors = [] } = req.body;
  const category = await Category.create({
    name,
    factors,
    owner: req.user.id,
    organization: req.user.organization,
  });
  res.status(201).json(category);
});

// PUT /api/categories/:id — update a reusable category template
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const { name, factors } = req.body;
  if (name !== undefined) category.name = name;
  if (factors !== undefined) category.factors = factors;
  await category.save();

  res.json(category);
});

// DELETE /api/categories/:id
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }
  res.json({ message: 'Category deleted' });
});
