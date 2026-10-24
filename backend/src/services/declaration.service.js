import {
  DECLARATION_STATUSES,
  DEFAULT_DECLARATION_STATUS,
} from '../constants/declaration-status.js';
import { EVENTS } from '../constants/events.js';
import { isAdminRole } from '../constants/roles.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../exceptions/app-error.js';

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

// What an update may change. Same idea as above: Joi already refuses the
// others, this layer must stay safe on its own. type, owner, status, picture
// and privateInfo are not in it.
const EDITABLE_FIELDS = ['title', 'description', 'date', 'location', 'category', 'attributes'];

// The statuses in which the OWNER may still edit. A matched declaration is
// being compared with another one, a hidden one is under moderation, a
// resolved one is closed, a deleted one is gone. Admins are not bound by this
// list (spec 7.3), only by "deleted".
const OWNER_EDITABLE_STATUSES = [DECLARATION_STATUSES.PENDING, DECLARATION_STATUSES.EXPIRED];

// A Mongoose document holds attributes as a Map, a plain object as an object.
function toPlainAttributes(attributes) {
  if (!attributes) return {};
  return attributes instanceof Map ? Object.fromEntries(attributes) : { ...attributes };
}

// Same attributes whatever the order of the keys.
function sameAttributes(a, b) {
  const left = Object.entries(toPlainAttributes(a)).sort(([x], [y]) => x.localeCompare(y));
  const right = Object.entries(toPlainAttributes(b)).sort(([x], [y]) => x.localeCompare(y));
  return JSON.stringify(left) === JSON.stringify(right);
}

// True when the value sent is different from the value stored.
function hasChanged(field, stored, sent) {
  if (field === 'attributes') return !sameAttributes(stored, sent);
  if (field === 'date') return new Date(stored).getTime() !== new Date(sent).getTime();
  return stored !== sent;
}

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

    // Edits the fields of a declaration, for its owner or an admin.
    //  - a deleted declaration does not exist for anybody (404);
    //  - a stranger gets 404 for a hidden one (as in getById) and 403 for any
    //    other: they can read it, so its existence is no secret;
    //  - the owner may edit only a pending or expired declaration (403
    //    otherwise), an admin may edit whatever is not deleted;
    //  - only the fields whose value really changes are written and announced.
    //    Sending the stored values again changes nothing, emits nothing and
    //    does not touch updatedAt.
    // The answer is the full view, like getById for the owner and admins.
    async update(user, id, input) {
      const found = await declarationRepository.findById(id);
      if (!found || found.status === DECLARATION_STATUSES.DELETED) throw notFound();

      const isOwner = String(found.owner) === String(user._id);
      const isAdmin = isAdminRole(user.role);

      if (!isOwner && !isAdmin) {
        if (found.status === DECLARATION_STATUSES.HIDDEN) throw notFound();
        throw new ForbiddenError('You are not allowed to edit this declaration');
      }

      if (!isAdmin && !OWNER_EDITABLE_STATUSES.includes(found.status)) {
        throw new ForbiddenError(`A ${found.status} declaration cannot be edited`);
      }

      const changes = {};
      for (const field of EDITABLE_FIELDS) {
        if (input[field] !== undefined && hasChanged(field, found[field], input[field])) {
          changes[field] = input[field];
        }
      }
      const changedFields = Object.keys(changes);

      if (changedFields.length === 0) {
        // Nothing to write, but the caller still gets the full view.
        const unchanged = await declarationRepository.findByIdWithPrivateInfo(id);
        if (!unchanged || unchanged.status === DECLARATION_STATUSES.DELETED) throw notFound();
        return unchanged;
      }

      const updated = await declarationRepository.updateFields(id, changes, found.status);
      // The status moved between the read and the write (hidden, deleted,
      // matched by the system). The decision above may no longer hold, so
      // nothing was written and the client is asked to look again.
      if (!updated) {
        throw new ConflictError('The declaration changed in the meantime, please reload it');
      }

      // After the save, never before: the matching code must find the new
      // values in the database. emit() never throws.
      await eventBus.emit(EVENTS.DECLARATION_UPDATED, {
        declarationId: String(updated._id),
        ownerId: String(found.owner),
        changedFields,
      });

      return updated;
    },
  };
}
