import {
  toDeclarationSummary,
  toOwnerDeclarationResponse,
  toPublicDeclarationResponse,
} from '../presenters/declaration.presenter.js';

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

    async listMine(req, res) {
      const { items, ...pagination } = await declarationService.listMine(req.user, req.query);

      res.status(200).json({ declarations: items.map(toDeclarationSummary), pagination });
    },

    // The service decides how much the reader may see, the presenter shapes
    // it. isOwner lets the client show the owner's actions, and ownerDeleted
    // is the "deleted user" label: a fact, not a sentence, so the wording
    // stays the client's choice (language, vocabulary of the context).
    async getById(req, res) {
      const { declaration, isOwner, canSeePrivate, ownerDeleted } =
        await declarationService.getById(req.user, req.params.id);

      res.status(200).json({
        declaration: canSeePrivate
          ? toOwnerDeclarationResponse(declaration)
          : toPublicDeclarationResponse(declaration),
        isOwner,
        ownerDeleted,
      });
    },

    // Only the owner and admins get here (the service refuses the others), so
    // the full view is the right one, like on the detail route.
    async update(req, res) {
      const declaration = await declarationService.update(req.user, req.params.id, req.body);

      res.status(200).json({ declaration: toOwnerDeclarationResponse(declaration) });
    },
  };
}
