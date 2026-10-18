import { CODE_PURPOSES } from '../constants/code-purposes.js';
import { InvalidCodeError } from '../exceptions/app-error.js';
import { EmailDeliveryError } from './email.service.js';

const silentLogger = { warn() {} };

export function createAuthService({
  userRepository,
  passwordHasher,
  verificationCodeService,
  logger = silentLogger,
}) {
  if (!verificationCodeService) {
    throw new Error('createAuthService(): verificationCodeService is required');
  }

  return {
    async register({ username, email, phone, password }) {
      const hashedPassword = await passwordHasher.hash(password);

      // Explicit fields only: role, isActive and the rest keep their model defaults.
      const user = await userRepository.create({
        username,
        email,
        phone,
        password: hashedPassword,
      });

      try {
        await verificationCodeService.issue({
          userId: user._id,
          email: user.email,
          purpose: CODE_PURPOSES.EMAIL_VERIFICATION,
        });
      } catch (err) {
        // The account exists and the unsent code was already removed, so the
        // user can ask for a new one immediately. Anything other than a
        // delivery problem is a real fault and must surface.
        if (!(err instanceof EmailDeliveryError)) throw err;
        logger.warn({ err, userId: String(user._id) }, 'Verification email could not be sent');
      }

      return user;
    },

    async verifyEmail({ email, code }) {
      const user = await userRepository.findByEmail(email);
      // Same error as a wrong code, so this route cannot be used to find out
      // which addresses have an account.
      if (!user) throw new InvalidCodeError();

      await verificationCodeService.verify({
        userId: user._id,
        purpose: CODE_PURPOSES.EMAIL_VERIFICATION,
        code,
      });

      const verified = await userRepository.markEmailVerified(user._id);
      if (!verified) throw new InvalidCodeError();
      return verified;
    },

    // Does nothing for an unknown or already verified address, so the caller
    // can answer the same way in every case. A cooldown (RateLimitedError) or
    // a delivery failure is NOT swallowed: the user asked for this email.
    async resendVerification({ email }) {
      const user = await userRepository.findByEmail(email);
      if (!user || user.isEmailVerified) return;

      await verificationCodeService.issue({
        userId: user._id,
        email: user.email,
        purpose: CODE_PURPOSES.EMAIL_VERIFICATION,
      });
    },
  };
}
