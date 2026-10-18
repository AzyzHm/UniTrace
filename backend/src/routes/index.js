import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import {
  createRegisterSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';
import { createAuthRoutes } from './auth.routes.js';

// Only mounts what it receives, so tests that do not need a database
// (health, error handling) keep using createApp() with no arguments.
export function createApiRouter({ authService, allowedEmailDomains = [] } = {}) {
  const router = Router();

  if (authService) {
    router.use(
      '/auth',
      createAuthRoutes({
        authController: createAuthController({ authService }),
        registerSchema: createRegisterSchema({ allowedEmailDomains }),
        verifyEmailSchema,
        resendVerificationSchema,
      }),
    );
  }

  return router;
}
