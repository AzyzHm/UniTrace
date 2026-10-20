import { vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createEventBus } from '../../src/events/event-bus.js';
import { createRequireAuth } from '../../src/middlewares/require-auth.js';
import { createRefreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import { createUserRepository } from '../../src/repositories/user.repository.js';
import { createVerificationCodeRepository } from '../../src/repositories/verification-code.repository.js';
import { createAccountDeletionService } from '../../src/services/account-deletion.service.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createCodeHasher } from '../../src/services/code-hasher.js';
import { createPasswordHasher } from '../../src/services/password-hasher.js';
import { createPasswordChangeService } from '../../src/services/password-change.service.js';
import { createPasswordResetService } from '../../src/services/password-reset.service.js';
import { createProfileService } from '../../src/services/profile.service.js';
import { createRefreshTokenHasher } from '../../src/services/refresh-token-hasher.js';
import { createSessionService } from '../../src/services/session.service.js';
import { createTokenService } from '../../src/services/token.service.js';
import { createVerificationCodeService } from '../../src/services/verification-code.service.js';

export const TEST_JWT_SECRET = 'j'.repeat(32);

// The real app on the in-memory database. Only the email sender is fake, and
// the clock only moves forward from the real time, so nothing expires in the
// database behind a test's back.
export function buildTestApp() {
  let now = Date.now();
  const clock = () => new Date(now);

  const emailService = {
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
  };

  const eventBus = createEventBus();
  const userRepository = createUserRepository();
  const refreshTokenRepository = createRefreshTokenRepository();
  const passwordHasher = createPasswordHasher({ cost: 4 });
  const tokenService = createTokenService({
    secret: TEST_JWT_SECRET,
    expiresIn: '15m',
    clock,
  });
  const verificationCodeRepository = createVerificationCodeRepository();
  const verificationCodeService = createVerificationCodeService({
    codeRepository: verificationCodeRepository,
    codeHasher: createCodeHasher({ secret: 'a'.repeat(32) }),
    emailService,
    clock,
  });

  const refreshTokenHasher = createRefreshTokenHasher();

  const app = createApp({
    authService: createAuthService({ userRepository, passwordHasher, verificationCodeService }),
    sessionService: createSessionService({
      userRepository,
      passwordHasher,
      tokenService,
      refreshTokenRepository,
      refreshTokenHasher,
      clock,
    }),
    passwordResetService: createPasswordResetService({
      userRepository,
      passwordHasher,
      verificationCodeService,
      refreshTokenRepository,
    }),
    profileService: createProfileService({ userRepository, verificationCodeService }),
    passwordChangeService: createPasswordChangeService({
      userRepository,
      passwordHasher,
      refreshTokenRepository,
      refreshTokenHasher,
      clock,
    }),
    accountDeletionService: createAccountDeletionService({
      userRepository,
      passwordHasher,
      refreshTokenRepository,
      verificationCodeRepository,
      eventBus,
      clock,
    }),
    requireAuth: createRequireAuth({ tokenService, userRepository }),
    allowedEmailDomains: ['isamm.uma.tn'],
  });

  return {
    app,
    eventBus,
    emailService,
    passwordHasher,
    tokenService,
    advance: (ms) => {
      now += ms;
    },
  };
}
