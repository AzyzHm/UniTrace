import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createUserRoutes({
  userController,
  requireAuth,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
}) {
  const router = Router();

  // Every /users route needs a logged in user, so it is declared once here.
  router.use(requireAuth);

  router.get('/me', userController.me);
  router.patch('/me', validate(updateProfileSchema), userController.updateMe);
  router.patch('/me/password', validate(changePasswordSchema), userController.changePassword);
  router.delete('/me', validate(deleteAccountSchema), userController.deleteMe);

  return router;
}
