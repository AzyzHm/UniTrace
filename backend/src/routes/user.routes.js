import { Router } from 'express';

export function createUserRoutes({ userController, requireAuth }) {
  const router = Router();

  // Every /users route needs a logged in user, so it is declared once here.
  router.use(requireAuth);

  router.get('/me', userController.me);

  return router;
}
