import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, ROLES } from '../config/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // Multi-tenant (Module 1): every user belongs to one organization.
    // Optional only for the platform-level super_admin, who spans all orgs.
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    // RBAC (Module 2).
    role: { type: String, enum: ROLE_VALUES, default: ROLES.CANDIDATE, index: true },
    isActive: { type: Boolean, default: true },
    // Guests are created when someone submits a public assessment link (Module 14).
    isGuest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash a plaintext password and store it. Keeps hashing logic in one place.
userSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the password hash in API responses.
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);
