import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createUserController } from '../controllers/user.controller.js';
import { createRefreshCookie } from '../utils/refresh-cookie.js';
import {
  createRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';
import { createUpdateProfileSchema } from '../validators/user.validator.js';
import { createAuthRoutes } from './auth.routes.js';
import { createUserRoutes } from './user.routes.js';

// Only mounts what it receives, so tests that do not need a database
// (health, error handling) keep using createApp() with no arguments.
export function createApiRouter({
  authService,
  sessionService,
  passwordResetService,
  profileService,
  requireAuth,
  allowedEmailDomains = [],
  secureCookies = false,
} = {}) {
  const router = Router();

  if (authService) {
    router.use(
      '/auth',
      createAuthRoutes({
        authController: createAuthController({
          authService,
          sessionService,
          passwordResetService,
          refreshCookie: createRefreshCookie({ secure: secureCookies }),
        }),
        registerSchema: createRegisterSchema({ allowedEmailDomains }),
        verifyEmailSchema,
        resendVerificationSchema,
        loginSchema,
        forgotPasswordSchema,
        resetPasswordSchema,
      }),
    );
  }

  if (requireAuth) {
    router.use(
      '/users',
      createUserRoutes({
        userController: createUserController({ profileService }),
        requireAuth,
        updateProfileSchema: createUpdateProfileSchema({ allowedEmailDomains }),
      }),
    );
  }

  return router;
}
