import mongoose from 'mongoose';

/**
 * An Organization is the top-level tenant. Every User, Category, Assessment and
 * Response belongs to exactly one Organization, so all queries are org-scoped.
 * `slug` is a URL-safe identifier used for public links and (later) white-label
 * custom domains.
 */
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Branding / white-label (Module 23). Optional today, wired up later.
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#4f46e5' },
    // Billing plan (Module 24). Free until payments land.
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

organizationSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model('Organization', organizationSchema);
