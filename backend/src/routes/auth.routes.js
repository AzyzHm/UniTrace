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

  return router;
}
