import { CODE_PURPOSES } from '../constants/code-purposes.js';
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
  };
}
