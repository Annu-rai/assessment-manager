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
});

const responseSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    respondent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: [answerSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('Response', responseSchema);
