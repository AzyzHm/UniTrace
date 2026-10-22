import { toOwnerDeclarationResponse } from '../presenters/declaration.presenter.js';

export function createDeclarationController({ declarationService }) {
  if (!declarationService) {
    throw new Error('createDeclarationController(): declarationService is required');
  }

  return {
    // The author just created it, so the owner view is the right one.
    async create(req, res) {
      const declaration = await declarationService.create(req.user, req.body);

      res.status(201).json({ declaration: toOwnerDeclarationResponse(declaration) });
    },
  };
}
