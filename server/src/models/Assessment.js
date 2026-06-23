import mongoose from 'mongoose';
import { factorSchema } from './Category.js';

/**
 * An Assessment is a saved snapshot of the categories built in the Builder.
 * We embed the full Category -> Factor -> Question tree (rather than referencing
 * Category docs) so that editing a reusable category template later does not
 * silently mutate an assessment that has already been launched/answered.
 */
const embeddedCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  factors: { type: [factorSchema], default: [] },
});

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categories: { type: [embeddedCategorySchema], default: [] },
  },
  { timestamps: true }
);

// Convenience virtual: total number of questions across all categories/factors.
assessmentSchema.virtual('questionCount').get(function questionCount() {
  // categories may be absent when the doc is populated with a field subset.
  return (this.categories || []).reduce(
    (sum, cat) => sum + (cat.factors || []).reduce((s, f) => s + (f.questions || []).length, 0),
    0
  );
});

assessmentSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Assessment', assessmentSchema);
