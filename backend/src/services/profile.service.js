import { CODE_PURPOSES } from '../constants/code-purposes.js';
import { RateLimitedError, UnauthenticatedError } from '../exceptions/app-error.js';
import { EmailDeliveryError } from './email.service.js';

const EDITABLE_FIELDS = ['username', 'email', 'phone'];

const silentLogger = { warn() {} };

// What the controller needs to know about the verification email.
export const VERIFICATION = Object.freeze({
  NOT_NEEDED: 'not_needed',
  SENT: 'sent',
  NOT_SENT: 'not_sent',
});

export function createProfileService({
  userRepository,
  verificationCodeService,
  logger = silentLogger,
}) {
  if (!userRepository || !verificationCodeService) {
    throw new Error(
      'createProfileService(): userRepository and verificationCodeService are required',
    );
  }

  // The change is already saved, so a code that cannot be sent right now must
  // not turn the whole request into an error. The user keeps a working
  // session and asks for a new code with resend-verification. Anything other
  // than a cooldown or a delivery problem is a real fault and must surface.
  async function sendVerificationCode(user) {
    try {
      await verificationCodeService.issue({
        userId: user._id,
        email: user.email,
        purpose: CODE_PURPOSES.EMAIL_VERIFICATION,
      });
      return VERIFICATION.SENT;
    } catch (err) {
      if (!(err instanceof RateLimitedError) && !(err instanceof EmailDeliveryError)) throw err;
      logger.warn({ err, userId: String(user._id) }, 'Verification email could not be sent');
      return VERIFICATION.NOT_SENT;
    }
  }

  return {
    // "user" is the connected user loaded by requireAuth, "input" is the
    // validated body. Only the fields that really change are written.
    async updateProfile(user, input) {
      // Explicit whitelist even though Joi already refuses other fields: this
      // layer must stay safe if it is ever called from somewhere else.
      const changes = {};
      for (const field of EDITABLE_FIELDS) {
        if (input[field] !== undefined && input[field] !== user[field]) {
          changes[field] = input[field];
        }
      }

      if (Object.keys(changes).length === 0) {
        return { user, verification: VERIFICATION.NOT_NEEDED };
      }

      // The new address is unproven, so the flag drops in the SAME update as
      // the address. There is no moment where the new email counts as verified.
      const emailChanged = changes.email !== undefined;
      if (emailChanged) changes.isEmailVerified = false;

      const updated = await userRepository.updateProfile(user._id, changes);
      if (!updated) throw new UnauthenticatedError('Invalid or expired token');
      if (!emailChanged) return { user: updated, verification: VERIFICATION.NOT_NEEDED };

      return {
        user: updated,
        verification: await sendVerificationCode(updated),
      };
    },
  };
}
