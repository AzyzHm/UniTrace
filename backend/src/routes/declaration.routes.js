import { Router } from 'express';
import { validate } from '../middlewares/validate.js';

export function createDeclarationRoutes({
  declarationController,
  requireAuth,
  createDeclarationSchema,
  listMyDeclarationsQuerySchema,
  declarationIdParamsSchema,
}) {
  const router = Router();

  // Every /declarations route needs a logged in user, so it is declared once.
  router.use(requireAuth);

  router.post('/', validate(createDeclarationSchema), declarationController.create);

  // Declared BEFORE any "/:id" route, otherwise Express reads "mine" as an id.
  router.get(
    '/mine',
    validate(listMyDeclarationsQuerySchema, 'query'),
    declarationController.listMine,
  );

  router.get('/:id', validate(declarationIdParamsSchema, 'params'), declarationController.getById);

  return router;
}
