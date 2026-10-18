import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Only the hash is stored, like a password. A database leak must not hand
    // out working sessions.
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    // Set when the token is rotated. A used token that comes back is the
    // signal that it was copied.
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Lookup by hash on every refresh, and no two tokens can share one.
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });

// Revoking every session of a user.
refreshTokenSchema.index({ user: 1 });

// MongoDB removes the document once expiresAt has passed. The cleanup runs
// about once a minute, so the service still checks expiresAt itself.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
