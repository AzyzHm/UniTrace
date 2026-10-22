import { DECLARATION_STATUSES as S } from '../constants/declaration-status.js';
import { EVENTS } from '../constants/events.js';
import { SYSTEM_ACTOR } from '../constants/roles.js';

// Spec 9.2. Open declarations have nobody left to act on them, so they go.
// matched, resolved and hidden ones are kept for the history of the other
// side, and the "deleted user" label is worked out at read time from the
// owner, so no status changes for them.
const DELETED_WITH_OWNER = Object.freeze([S.PENDING, S.EXPIRED]);

export function createDeclarationCleanupService({ declarationRepository, eventBus }) {
  if (!declarationRepository) {
    throw new Error('createDeclarationCleanupService(): declarationRepository is required');
  }
  if (!eventBus) {
    throw new Error('createDeclarationCleanupService(): eventBus is required');
  }

  return {
    // Reacts to user.deleted. Both steps are independent, so a failure in one
    // never skips the other. The first failure is rethrown afterwards, and the
    // event bus logs it without failing the deletion that already happened.
    async handleOwnerDeleted({ userId, deletedAt }) {
      const [wiped, removed] = await Promise.allSettled([
        declarationRepository.clearPrivateInfoByOwner(userId),
        declarationRepository.softDeleteByOwner(userId, DELETED_WITH_OWNER, deletedAt),
      ]);

      if (removed.status === 'fulfilled') {
        await Promise.all(
          removed.value.map(({ id, from }) =>
            eventBus.emit(EVENTS.DECLARATION_STATUS_CHANGED, {
              declarationId: id,
              ownerId: String(userId),
              from,
              to: S.DELETED,
              actor: SYSTEM_ACTOR,
              reason: 'owner_deleted',
            }),
          ),
        );
      }

      const failure = [wiped, removed].find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
    },
  };
}
