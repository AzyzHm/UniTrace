import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createUserRoutes({ userController, requireAuth, updateProfileSchema }) {
  const router = Router();

  // Every /users route needs a logged in user, so it is declared once here.
  router.use(requireAuth);

  router.get('/me', userController.me);
  router.patch('/me', validate(updateProfileSchema), userController.updateMe);

  return router;
}
