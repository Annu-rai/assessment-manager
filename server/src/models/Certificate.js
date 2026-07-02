import mongoose from 'mongoose';

/**
 * A Certificate is issued when a candidate passes a graded assessment (Module 17).
 * Candidate/assessment details are snapshotted so a public verification stays
 * valid even if the underlying records change. `certificateId` is the public,
 * URL-safe code embedded in the QR for verification.
 */
const certificateSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    response: { type: mongoose.Schema.Types.ObjectId, ref: 'Response', required: true, unique: true },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' },
    assessmentTitle: { type: String, default: '' },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    candidateName: { type: String, default: '' },
    candidateEmail: { type: String, default: '' },
    percentage: { type: Number, default: 0 },
    certificateId: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Certificate', certificateSchema);
