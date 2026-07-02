import mongoose from 'mongoose';
import { QUESTION_TYPES } from './Category.js';

/**
 * A standalone, reusable Question in the org's Question Bank (Module 8).
 * Same answer shape as an embedded assessment question, plus bank metadata
 * (difficulty, tags, topic) for filtering and randomized selection.
 */
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const pairSchema = new mongoose.Schema(
  { left: { type: String, default: '' }, right: { type: String, default: '' } },
  { _id: false }
);

const questionBankSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    text: { type: String, required: true, trim: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    options: { type: [String], default: [] },
    ratingScale: { type: Number, default: 5 },
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    points: { type: Number, default: 1, min: 0 },
    tolerance: { type: Number, default: 0, min: 0 },
    pairs: { type: [pairSchema], default: [] },
    accept: { type: String, default: '' },

    // Bank metadata
    topic: { type: String, default: '', trim: true, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium', index: true },
    tags: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Question', questionBankSchema);
