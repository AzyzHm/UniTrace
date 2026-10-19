import { CODE_PURPOSES } from '../constants/code-purposes.js';
import { InvalidCodeError } from '../exceptions/app-error.js';

// A suspended or deleted account gets no code and cannot use one. The caller
// sees the same answer as for an unknown address, so this is not a way to
// find out which accounts exist or which are suspended.
function canResetPassword(user) {
  return Boolean(user) && !user.deletedAt && user.isActive;
}

export function createPasswordResetService({
  userRepository,
  passwordHasher,
  verificationCodeService,
  refreshTokenRepository,
}) {
  const dependencies = {
    userRepository,
    passwordHasher,
    verificationCodeService,
    refreshTokenRepository,
  };
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency) {
      throw new Error(`createPasswordResetService(): ${name} is required`);
    }
  }

  return {
    // Does nothing for an address that cannot reset, so the caller can answer
    // the same way in every case. A cooldown (RateLimitedError) or a delivery
    // failure is NOT swallowed: the user asked for this email.
    async requestReset({ email }) {
      const user = await userRepository.findByEmail(email);
      if (!canResetPassword(user)) return;

      await verificationCodeService.issue({
        userId: user._id,
        email: user.email,
        purpose: CODE_PURPOSES.PASSWORD_RESET,
      });
    },

    async resetPassword({ email, code, newPassword }) {
      const user = await userRepository.findByEmail(email);
      // Same error as a wrong code, and nothing is checked or consumed.
      if (!canResetPassword(user)) throw new InvalidCodeError();

      // The code first: it is cheap and limited to a few attempts, while
      // hashing is slow and must not be triggered by someone guessing.
      await verificationCodeService.verify({
        userId: user._id,
        purpose: CODE_PURPOSES.PASSWORD_RESET,
        code,
      });

      const passwordHash = await passwordHasher.hash(newPassword);
      const updated = await userRepository.updatePassword(user._id, passwordHash);
      if (!updated) throw new InvalidCodeError();

      // After the password changed, never before. A session that outlives a
      // password change is the dangerous failure, and a refresh that sneaks in
      // between the two steps is removed by this delete as well.
      await refreshTokenRepository.deleteAllForUser(user._id);
    },
  };
}
