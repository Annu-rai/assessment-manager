import mongoose from 'mongoose';

/**
 * A single answer. We denormalise the question text/type/location so Reports
 * can render a submission without re-walking the assessment tree, and so the
 * report stays accurate even if the assessment is edited afterwards.
 */
const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  categoryName: { type: String, default: '' },
  factorName: { type: String, default: '' },
  questionText: { type: String, default: '' },
  type: { type: String, default: '' },
  // answer is mixed: string for text/choice, number for rating, boolean for boolean.
  answer: { type: mongoose.Schema.Types.Mixed, default: null },
  // Per-answer grading (null when the question is ungraded / survey-style).
  isCorrect: { type: Boolean, default: null },
  pointsAwarded: { type: Number, default: 0 },
  pointsPossible: { type: Number, default: 0 },
  // AI evaluation of descriptive answers (Module 6). aiScore is null until graded.
  aiGraded: { type: Boolean, default: false },
  aiScore: { type: Number, default: null },
  aiFeedback: { type: String, default: '' },
});

const responseSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    respondent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    answers: { type: [answerSchema], default: [] },
    // Aggregate scoring result (Module 3/15). `graded` is false for pure surveys.
    graded: { type: Boolean, default: false },
    score: { type: Number, default: 0 }, // points awarded
    maxScore: { type: Number, default: 0 }, // points possible across graded questions
    percentage: { type: Number, default: 0 }, // 0-100
    passed: { type: Boolean, default: null }, // null when ungraded
    aiEvaluatedAt: { type: Date, default: null }, // when AI essay grading last ran
  },
  { timestamps: true }
);

export default mongoose.model('Response', responseSchema);
