import mongoose from 'mongoose';

/**
 * An immutable record of a significant action (Module 25) — who did what, when.
 * Scoped to an organization so admins see only their org's trail.
 */
const auditLogSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, index: true }, // e.g. "assessment.create"
    target: { type: String, default: '' }, // human-readable subject of the action
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);
