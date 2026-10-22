import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createDeclarationRoutes({
  declarationController,
  requireAuth,
  createDeclarationSchema,
}) {
  const router = Router();

  // Every /declarations route needs a logged in user, so it is declared once.
  router.use(requireAuth);

  router.post('/', validate(createDeclarationSchema), declarationController.create);

  return router;
}
