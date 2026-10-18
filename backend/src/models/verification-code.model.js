import mongoose from 'mongoose';
import { CODE_PURPOSE_VALUES } from '../constants/code-purposes.js';

const verificationCodeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: CODE_PURPOSE_VALUES, required: true },
  // Only the hash is stored, like a password. A database leak must not
  // hand out working codes.
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastSentAt: { type: Date, default: Date.now },
});

// One live code per user and purpose: a new code replaces the old one.
verificationCodeSchema.index({ user: 1, purpose: 1 }, { unique: true });

// MongoDB removes the document once expiresAt has passed. The cleanup runs
// about once a minute, so the service still checks expiresAt itself.
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);
