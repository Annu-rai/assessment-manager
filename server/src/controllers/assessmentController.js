import asyncHandler from 'express-async-handler';
import Assessment from '../models/Assessment.js';
import Category from '../models/Category.js';

// GET /api/assessments — list the user's saved assessments (summary fields)
export const listAssessments = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ owner: req.user.id }).sort('-createdAt');
  res.json(assessments);
});

// GET /api/assessments/:id — full assessment with the question tree
export const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOne({ _id: req.params.id, owner: req.user.id });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  res.json(assessment);
});

/**
 * POST /api/assessments — save a built assessment.
 * Embeds the category tree as a snapshot AND mirrors each category into the
 * reusable Category template library so it shows up under "Load Categories".
 */
export const createAssessment = asyncHandler(async (req, res) => {
  const { title, description = '', categories = [] } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400);
    throw new Error('An assessment needs at least one category');
  }

  const assessment = await Assessment.create({
    title,
    description,
    categories,
    owner: req.user.id,
  });

  // Mirror categories into the reusable library (best-effort, non-fatal).
  try {
    await Promise.all(
      categories.map((cat) =>
        Category.create({
          name: cat.name,
          factors: cat.factors || [],
          owner: req.user.id,
        })
      )
    );
  } catch (err) {
    console.warn('Could not mirror categories to template library:', err.message);
  }

  res.status(201).json(assessment);
});

// DELETE /api/assessments/:id
export const deleteAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!assessment) {
    res.status(404);
    throw new Error('Assessment not found');
  }
  res.json({ message: 'Assessment deleted' });
});
