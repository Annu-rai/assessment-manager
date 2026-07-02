import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Question from '../models/Question.js';
import { orgFilter } from '../middleware/rbac.js';
import { ROLES } from '../config/roles.js';

// Build a Mongo filter from optional query params (type/difficulty/tag/topic/search).
function buildFilter(req) {
  const filter = orgFilter(req);
  if (req.query.type) filter.type = req.query.type;
  if (req.query.difficulty) filter.difficulty = req.query.difficulty;
  if (req.query.tag) filter.tags = req.query.tag;
  if (req.query.topic) filter.topic = req.query.topic;
  if (req.query.search) filter.text = { $regex: req.query.search, $options: 'i' };
  return filter;
}

// GET /api/questions — list bank questions (filterable)
export const listQuestions = asyncHandler(async (req, res) => {
  const questions = await Question.find(buildFilter(req)).sort('-updatedAt').limit(500);
  res.json(questions);
});

// GET /api/questions/random?count=N — random selection matching filters (Module 8 randomization)
export const randomQuestions = asyncHandler(async (req, res) => {
  const count = Math.max(1, Math.min(50, parseInt(req.query.count, 10) || 5));

  // $sample needs a plain match; scope by org unless super_admin.
  const match = {};
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    match.organization = new mongoose.Types.ObjectId(req.user.organization);
  }
  if (req.query.type) match.type = req.query.type;
  if (req.query.difficulty) match.difficulty = req.query.difficulty;
  if (req.query.topic) match.topic = req.query.topic;
  if (req.query.tag) match.tags = req.query.tag;

  const questions = await Question.aggregate([{ $match: match }, { $sample: { size: count } }]);
  res.json(questions);
});

// POST /api/questions — add a question to the bank
export const createQuestion = asyncHandler(async (req, res) => {
  const question = await Question.create({
    ...req.body,
    owner: req.user.id,
    organization: req.user.organization,
  });
  res.status(201).json(question);
});

// PUT /api/questions/:id
export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findOne({ _id: req.params.id, ...orgFilter(req) });
  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }
  const editable = [
    'text', 'type', 'options', 'ratingScale', 'correctAnswer',
    'points', 'tolerance', 'pairs', 'accept', 'topic', 'difficulty', 'tags',
  ];
  for (const f of editable) {
    if (req.body[f] !== undefined) question[f] = req.body[f];
  }
  await question.save();
  res.json(question);
});

// DELETE /api/questions/:id
export const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findOneAndDelete({ _id: req.params.id, ...orgFilter(req) });
  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }
  res.json({ message: 'Question deleted' });
});
