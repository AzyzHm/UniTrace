import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './db/connection.js';

import { createRequireAuth } from './middlewares/require-auth.js';
import { createRefreshTokenRepository } from './repositories/refresh-token.repository.js';
import { createUserRepository } from './repositories/user.repository.js';
import { createPasswordHasher } from './services/password-hasher.js';
import { createAuthService } from './services/auth.service.js';
import { createPasswordResetService } from './services/password-reset.service.js';
import { createProfileService } from './services/profile.service.js';
import { createRefreshTokenHasher } from './services/refresh-token-hasher.js';
import { createSessionService } from './services/session.service.js';
import { createTokenService } from './services/token.service.js';
import { createVerificationCodeRepository } from './repositories/verification-code.repository.js';
import { createCodeHasher } from './services/code-hasher.js';
import { createConsoleEmailService, createEmailService } from './services/email.service.js';
import { createVerificationCodeService } from './services/verification-code.service.js';

async function start() {
  await connectDb(env.mongoUri);

  const userRepository = createUserRepository();
  const refreshTokenRepository = createRefreshTokenRepository();
  const passwordHasher = createPasswordHasher();
  const { apiKey, inboxId } = env.agentmail;
  const emailService =
    apiKey && inboxId
      ? createEmailService({ apiKey, inboxId })
      : createConsoleEmailService({ logger });
  if (!apiKey || !inboxId) {
    logger.warn('AgentMail is not configured: verification codes are logged, not emailed');
  }

  const verificationCodeService = createVerificationCodeService({
    codeRepository: createVerificationCodeRepository(),
    codeHasher: createCodeHasher({ secret: env.codeHashSecret }),
    emailService,
  });

  const tokenService = createTokenService({
    secret: env.jwt.accessSecret,
    expiresIn: env.jwt.accessExpires,
  });

  const authService = createAuthService({
    userRepository,
    passwordHasher,
    verificationCodeService,
    logger,
  });

  const sessionService = createSessionService({
    userRepository,
    passwordHasher,
    tokenService,
    refreshTokenRepository,
    refreshTokenHasher: createRefreshTokenHasher(),
    logger,
  });

  const passwordResetService = createPasswordResetService({
    userRepository,
    passwordHasher,
    verificationCodeService,
    refreshTokenRepository,
  });

  const profileService = createProfileService({
    userRepository,
    verificationCodeService,
    logger,
  });

  const requireAuth = createRequireAuth({ tokenService, userRepository });

  const app = createApp({
    logger,
    authService,
    sessionService,
    passwordResetService,
    profileService,
    requireAuth,
    allowedEmailDomains: env.allowedEmailDomains,
    secureCookies: env.nodeEnv === 'production',
  });
  const server = app.listen(env.port, () => {
    logger.info(`UniTrace API listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start the server');
  process.exit(1);
});
