import { DEFAULT_DECLARATION_STATUS } from '../constants/declaration-status.js';
import { EVENTS } from '../constants/events.js';

// What a user may send when creating a declaration. An explicit whitelist even
// though Joi already refuses other fields: this layer must stay safe if it is
// ever called from somewhere else.
const CREATABLE_FIELDS = [
  'title',
  'type',
  'description',
  'date',
  'location',
  'category',
  'attributes',
  'privateInfo',
];

export function createDeclarationService({ declarationRepository, eventBus }) {
  if (!declarationRepository || !eventBus) {
    throw new Error('createDeclarationService(): declarationRepository and eventBus are required');
  }

  return {
    // "user" is the connected user loaded by requireAuth, "input" is the
    // validated body.
    async create(user, input) {
      const data = {};
      for (const field of CREATABLE_FIELDS) {
        if (input[field] !== undefined) data[field] = input[field];
      }

      // owner and status are set AFTER the user's data and are never read from
      // it: the owner is the token's user, and every declaration starts pending.
      const declaration = await declarationRepository.create({
        ...data,
        owner: user._id,
        status: DEFAULT_DECLARATION_STATUS,
      });

      // After the save, never before: the matching code must find it in the
      // database. emit() never throws, so a broken listener cannot turn a
      // saved declaration into an error response.
      await eventBus.emit(EVENTS.DECLARATION_CREATED, {
        declarationId: String(declaration._id),
        ownerId: String(user._id),
        type: declaration.type,
        category: declaration.category,
      });

      return declaration;
    },

    // "query" is the validated query string, so page and limit are numbers
    // with their defaults already applied. The skip is computed here, the
    // repository only knows about skip and limit.
    async listMine(user, { page, limit, type, status }) {
      const { items, total } = await declarationRepository.findPageByOwner(user._id, {
        type,
        status,
        skip: (page - 1) * limit,
        limit,
      });

      return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    },
  };
}
