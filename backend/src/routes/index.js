import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createUserController } from '../controllers/user.controller.js';
import { createRefreshCookie } from '../utils/refresh-cookie.js';
import {
  createRegisterSchema,
  loginSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';
import { createAuthRoutes } from './auth.routes.js';
import { createUserRoutes } from './user.routes.js';

// Only mounts what it receives, so tests that do not need a database
// (health, error handling) keep using createApp() with no arguments.
export function createApiRouter({
  authService,
  sessionService,
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
          refreshCookie: createRefreshCookie({ secure: secureCookies }),
        }),
        registerSchema: createRegisterSchema({ allowedEmailDomains }),
        verifyEmailSchema,
        resendVerificationSchema,
        loginSchema,
      }),
    );
  }

  if (requireAuth) {
    router.use('/users', createUserRoutes({ userController: createUserController(), requireAuth }));
  }

  return router;
}
