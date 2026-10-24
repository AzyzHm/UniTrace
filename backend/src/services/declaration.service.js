import {
  DECLARATION_STATUSES,
  DEFAULT_DECLARATION_STATUS,
} from '../constants/declaration-status.js';
import { EVENTS } from '../constants/events.js';
import { isAdminRole } from '../constants/roles.js';
import { NotFoundError } from '../exceptions/app-error.js';

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

export function createDeclarationService({ declarationRepository, userRepository, eventBus }) {
  if (!declarationRepository || !userRepository || !eventBus) {
    throw new Error(
      'createDeclarationService(): declarationRepository, userRepository and eventBus are required',
    );
  }

  // One message for "does not exist", "is deleted" and "is hidden from you":
  // the answer must not reveal which of the three it is.
  const notFound = () => new NotFoundError('Declaration not found');

  // A declaration outlives its owner's account when it is matched, resolved or
  // hidden (spec 9.2). Readers then see a "deleted user" label instead of the
  // owner. A user that cannot be found at all counts as deleted too: nothing
  // hard deletes a user, so it can only mean the account is gone.
  async function isOwnerDeleted(ownerId) {
    const owner = await userRepository.findById(ownerId);
    return !owner || Boolean(owner.deletedAt);
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

    // Reads one declaration for the connected user and says how much of it
    // that user may see:
    //  - a deleted declaration does not exist for anybody (404);
    //  - a hidden one exists only for its owner and for admins (404 for the
    //    others, never 403, so its existence is not confirmed);
    //  - the owner and admins get the private detail, everybody else the
    //    public split.
    // The private detail is loaded by a second query and only after the check,
    // so a declaration read by a stranger never has it in memory.
    async getById(user, id) {
      const found = await declarationRepository.findById(id);
      if (!found || found.status === DECLARATION_STATUSES.DELETED) throw notFound();

      const isOwner = String(found.owner) === String(user._id);
      const canSeePrivate = isOwner || isAdminRole(user.role);

      if (!canSeePrivate) {
        if (found.status === DECLARATION_STATUSES.HIDDEN) throw notFound();

        return {
          declaration: found,
          isOwner: false,
          canSeePrivate: false,
          ownerDeleted: await isOwnerDeleted(found.owner),
        };
      }

      const full = await declarationRepository.findByIdWithPrivateInfo(id);
      // Deleted between the two reads: the same answer as if it never existed.
      if (!full || full.status === DECLARATION_STATUSES.DELETED) throw notFound();

      return {
        declaration: full,
        isOwner,
        canSeePrivate: true,
        // The connected owner is by definition not deleted, no query needed.
        ownerDeleted: isOwner ? false : await isOwnerDeleted(full.owner),
      };
    },
  };
}
