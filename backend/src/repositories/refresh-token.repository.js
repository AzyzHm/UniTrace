import { RefreshToken } from '../models/refresh-token.model.js';

export function createRefreshTokenRepository({ model = RefreshToken } = {}) {
  return {
    create({ userId, tokenHash, expiresAt }) {
      return model.create({ user: userId, tokenHash, expiresAt });
    },

    findByHash(tokenHash) {
      return model.findOne({ tokenHash });
    },

    // Marks the token as used, but only if it is still unused and not expired.
    // The filter and the update are one atomic operation, so of several
    // simultaneous requests with the same token exactly one gets a document
    // back and the others get null.
    claim({ tokenHash, now }) {
      return model.findOneAndUpdate(
        { tokenHash, usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { returnDocument: 'after' },
      );
    },

    async deleteByHash(tokenHash) {
      const result = await model.deleteOne({ tokenHash });
      return result.deletedCount > 0;
    },

    async deleteAllForUser(userId) {
      await model.deleteMany({ user: userId });
    },
  };
}
