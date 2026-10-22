import { EVENTS } from '../constants/events.js';

// Everything the declarations code reacts to, in one place. Returns a function
// that removes the listeners again (the tests use it).
export function registerDeclarationListeners({ eventBus, declarationCleanupService }) {
  const offs = [
    eventBus.on(EVENTS.USER_DELETED, (payload) =>
      declarationCleanupService.handleOwnerDeleted(payload),
    ),
  ];

  return () => offs.forEach((off) => off());
}
