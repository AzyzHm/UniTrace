import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createAuthRoutes({
  authController,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
}) {
  const router = Router();

  router.post('/register', validate(registerSchema), authController.register);
  router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
  router.post(
    '/resend-verification',
    validate(resendVerificationSchema),
    authController.resendVerification,
  );
  router.post('/login', validate(loginSchema), authController.login);

  // No body and no schema: both routes work from the cookie alone, and logout
  // must keep working after the access token has expired.
  router.post('/refresh', authController.refresh);
  router.post('/logout', authController.logout);

  return router;
}
