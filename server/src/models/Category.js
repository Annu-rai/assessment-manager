import mongoose from 'mongoose';

export const QUESTION_TYPES = ['multiple_choice', 'single_choice', 'rating', 'text', 'boolean'];

/**
 * A single question. Choice-based types use `options`; rating uses `ratingScale`.
 * Each question gets its own _id so responses can reference it.
 */
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  options: { type: [String], default: [] },
  ratingScale: { type: Number, default: 5 },
});

const factorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  questions: { type: [questionSchema], default: [] },
});

/**
 * A reusable Category template (Category -> Factors -> Questions).
 * These are persisted independently so the Builder's "Load Categories"
 * feature can pull previously created categories back in.
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    factors: { type: [factorSchema], default: [] },
  },
  { timestamps: true }
);

export { questionSchema, factorSchema };
export default mongoose.model('Category', categorySchema);
