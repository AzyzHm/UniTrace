import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createAuthRoutes({ authController, registerSchema }) {
  const router = Router();

  router.post('/register', validate(registerSchema), authController.register);

  return router;
}
