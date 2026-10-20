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
import { changePasswordSchema, createUpdateProfileSchema } from '../validators/user.validator.js';
import { createAuthRoutes } from './auth.routes.js';
import { createUserRoutes } from './user.routes.js';

// Only mounts what it receives, so tests that do not need a database
// (health, error handling) keep using createApp() with no arguments.
export function createApiRouter({
  authService,
  sessionService,
  passwordResetService,
  profileService,
  passwordChangeService,
  requireAuth,
  allowedEmailDomains = [],
  secureCookies = false,
} = {}) {
  const router = Router();
  // One instance for auth and users, so both read and clear the same cookie.
  const refreshCookie = createRefreshCookie({ secure: secureCookies });

  if (authService) {
    router.use(
      '/auth',
      createAuthRoutes({
        authController: createAuthController({
          authService,
          sessionService,
          passwordResetService,
          refreshCookie,
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
        userController: createUserController({
          profileService,
          passwordChangeService,
          refreshCookie,
        }),
        requireAuth,
        updateProfileSchema: createUpdateProfileSchema({ allowedEmailDomains }),
        changePasswordSchema,
      }),
    );
  }

  return router;
}
