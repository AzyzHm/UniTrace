import { VerificationCode } from '../models/verification-code.model.js';

const DUPLICATE_KEY = 11000;

export function createVerificationCodeRepository({ model = VerificationCode } = {}) {
  return {
    async replaceCode({ userId, purpose, codeHash, expiresAt, sentAt, cooldownMs }) {
      const sentBefore = new Date(sentAt.getTime() - cooldownMs);

      try {
        return await model.findOneAndUpdate(
          { user: userId, purpose, lastSentAt: { $lte: sentBefore } },
          { $set: { codeHash, expiresAt, attempts: 0, lastSentAt: sentAt } },
          { upsert: true, returnDocument: 'after' },
        );
      } catch (err) {
        if (err.code === DUPLICATE_KEY) return null;
        throw err;
      }
    },

    findByUserAndPurpose({ userId, purpose }) {
      return model.findOne({ user: userId, purpose });
    },

    consumeAttempt({ userId, purpose, maxAttempts }) {
      return model.findOneAndUpdate(
        { user: userId, purpose, attempts: { $lt: maxAttempts } },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      );
    },

    async delete({ userId, purpose }) {
      const result = await model.deleteOne({ user: userId, purpose });
      return result.deletedCount > 0;
    },

    async deleteAllForUser(userId) {
      await model.deleteMany({ user: userId });
    },
  };
}
