import mongoose from 'mongoose';

export const QUESTION_TYPES = [
  // Choice / scalar
  'multiple_choice',
  'single_choice',
  'rating',
  'text',
  'boolean',
  // Auto-gradable additions
  'numerical',
  'fill_blank',
  'match',
  // Free-form / media (ungraded until AI evaluation / manual review)
  'essay',
  'file_upload',
  'audio',
  'video',
  'image_based',
];

// The subset that the scoring engine can auto-grade against a correctAnswer.
export const GRADEABLE_TYPES = [
  'multiple_choice',
  'single_choice',
  'boolean',
  'numerical',
  'fill_blank',
  'match',
];

/**
 * A single question. Choice-based types use `options`; rating uses `ratingScale`.
 * Each question gets its own _id so responses can reference it.
 *
 * Scoring (foundation for analytics/certificates): a question is "scored" when it
 * has a non-null `correctAnswer`. For single_choice/boolean that's a scalar; for
 * multiple_choice it's an array of the correct option strings. Survey-style
 * questions (text, rating, or no correct answer set) are left ungraded.
 */
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: QUESTION_TYPES, required: true },
  options: { type: [String], default: [] },
  ratingScale: { type: Number, default: 5 },
  // correctAnswer is Mixed and shape depends on type:
  //  - single_choice/boolean: string
  //  - multiple_choice: [String]
  //  - numerical: number
  //  - fill_blank: string, or [String] of acceptable answers
  //  - match: derived from `pairs` (see below); correctAnswer left null
  //  - null/undefined for ungraded (rating/text/essay/media) questions.
  correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
  points: { type: Number, default: 1, min: 0 },
  // numerical: absolute tolerance for a correct answer (|submitted - correct| <= tolerance).
  tolerance: { type: Number, default: 0, min: 0 },
  // match: ordered pairs the candidate must connect (left -> right).
  pairs: {
    type: [
      new mongoose.Schema(
        { left: { type: String, default: '' }, right: { type: String, default: '' } },
        { _id: false }
      ),
    ],
    default: [],
  },
  // media hint (e.g. "image/*", "application/pdf") for file_upload/audio/video/image_based.
  accept: { type: String, default: '' },
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
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    factors: { type: [factorSchema], default: [] },
  },
  { timestamps: true }
);

export { questionSchema, factorSchema };
export default mongoose.model('Category', categorySchema);
