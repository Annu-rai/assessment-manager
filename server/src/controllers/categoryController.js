import asyncHandler from 'express-async-handler';
import Category from '../models/Category.js';

// GET /api/categories  — list the current user's reusable category templates
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ owner: req.user.id }).sort('-updatedAt');
  res.json(categories);
});

// POST /api/categories — create a reusable category template
export const createCategory = asyncHandler(async (req, res) => {
  const { name, factors = [] } = req.body;
  const category = await Category.create({ name, factors, owner: req.user.id });
  res.status(201).json(category);
});

// PUT /api/categories/:id — update a reusable category template
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, owner: req.user.id });
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
  const category = await Category.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }
  res.json({ message: 'Category deleted' });
});
