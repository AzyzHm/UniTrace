import { CODE_PURPOSES } from '../constants/code-purposes.js';
import {
  CODE_MAX_ATTEMPTS,
  CODE_RESEND_COOLDOWN_MS,
  CODE_TTL_MS,
} from '../constants/verification-code.js';
import { InvalidCodeError, RateLimitedError } from '../exceptions/app-error.js';

const EMAIL_METHOD_BY_PURPOSE = Object.freeze({
  [CODE_PURPOSES.EMAIL_VERIFICATION]: 'sendVerificationCode',
  [CODE_PURPOSES.PASSWORD_RESET]: 'sendPasswordResetCode',
});

export function createVerificationCodeService({
  codeRepository,
  codeHasher,
  emailService,
  clock = () => new Date(),
}) {
  function emailSenderFor(purpose) {
    const method = EMAIL_METHOD_BY_PURPOSE[purpose];
    if (!method) {
      throw new Error(`Unknown code purpose "${purpose}"`);
    }
    return (to, code) => emailService[method](to, code);
  }

  async function secondsUntilResend({ userId, purpose, now }) {
    const existing = await codeRepository.findByUserAndPurpose({ userId, purpose });
    // The old code can disappear between the refused write and this read
    // (TTL cleanup, a delete). Then waiting 1 second is a safe answer.
    if (!existing) return 1;

    const msLeft = existing.lastSentAt.getTime() + CODE_RESEND_COOLDOWN_MS - now.getTime();
    return Math.max(1, Math.ceil(msLeft / 1000));
  }

  // Creates a fresh code (replacing any old one) and emails it.
  async function issue({ userId, email, purpose }) {
    // Checked first, so an unknown purpose writes nothing.
    const send = emailSenderFor(purpose);

    const now = clock();
    const code = codeHasher.generate();

    const stored = await codeRepository.replaceCode({
      userId,
      purpose,
      codeHash: codeHasher.hash(code, { userId, purpose }),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      sentAt: now,
      cooldownMs: CODE_RESEND_COOLDOWN_MS,
    });

    if (!stored) {
      const retryAfterSeconds = await secondsUntilResend({ userId, purpose, now });
      throw new RateLimitedError('Please wait before requesting another code', {
        retryAfterSeconds,
      });
    }

    try {
      await send(email, code);
    } catch (err) {
      // The user never got this code, so do not keep the cooldown running.
      await codeRepository.delete({ userId, purpose });
      throw err;
    }
  }

  // Resolves when the code is right. Every failure is the same InvalidCodeError.
  async function verify({ userId, purpose, code }) {
    // Counts the attempt BEFORE comparing, atomically. Returns null when
    // there is no code or the attempts are used up.
    const stored = await codeRepository.consumeAttempt({
      userId,
      purpose,
      maxAttempts: CODE_MAX_ATTEMPTS,
    });
    if (!stored) throw new InvalidCodeError();

    if (stored.expiresAt.getTime() <= clock().getTime()) {
      await codeRepository.delete({ userId, purpose });
      throw new InvalidCodeError();
    }

    if (!codeHasher.matches(code, stored.codeHash, { userId, purpose })) {
      throw new InvalidCodeError();
    }

    // One-time use. If two requests send the right code at once, both reach
    // this line, but only one delete removes a document.
    const consumed = await codeRepository.delete({ userId, purpose });
    if (!consumed) throw new InvalidCodeError();
  }

  return { issue, verify };
}
