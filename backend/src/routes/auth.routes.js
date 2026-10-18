import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createAuthRoutes({
  authController,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
}) {
  const router = Router();

  router.post('/register', validate(registerSchema), authController.register);
  router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
  router.post(
    '/resend-verification',
    validate(resendVerificationSchema),
    authController.resendVerification,
  );

  return router;
}
