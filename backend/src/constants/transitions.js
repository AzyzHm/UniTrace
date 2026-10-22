import { DECLARATION_STATUSES as S } from './declaration-status.js';
import { ROLES, SYSTEM_ACTOR } from './roles.js';

const { USER, ADMIN } = ROLES;

// from -> to -> actors allowed to make that move
const TRANSITIONS = Object.freeze({
  [S.PENDING]: {
    [S.MATCHED]: [SYSTEM_ACTOR],
    [S.RESOLVED]: [USER, ADMIN],
    [S.EXPIRED]: [SYSTEM_ACTOR],
    [S.HIDDEN]: [ADMIN],
    [S.DELETED]: [USER, ADMIN],
  },
  [S.MATCHED]: {
    [S.PENDING]: [SYSTEM_ACTOR],
    [S.RESOLVED]: [USER, ADMIN],
    [S.HIDDEN]: [ADMIN],
    [S.DELETED]: [USER, ADMIN],
  },
  // A resolved declaration is final for its owner. Only an admin can reopen,
  // hide or delete it (moderation must reach a fake "I found it" too).
  [S.RESOLVED]: {
    [S.PENDING]: [ADMIN],
    [S.HIDDEN]: [ADMIN],
    [S.DELETED]: [ADMIN],
  },
  [S.EXPIRED]: {
    [S.PENDING]: [USER, ADMIN],
    [S.DELETED]: [USER, ADMIN],
  },
  // Restoring goes back to the status kept in statusBeforeHidden, so every
  // status a declaration can be hidden from is a valid target here.
  [S.HIDDEN]: {
    [S.PENDING]: [ADMIN],
    [S.MATCHED]: [ADMIN],
    [S.RESOLVED]: [ADMIN],
    [S.DELETED]: [ADMIN],
  },
  [S.DELETED]: {},
});

export function canTransition(from, to, role) {
  const allowedActors = TRANSITIONS[from]?.[to];
  if (!allowedActors) return false;
  return allowedActors.includes(role);
}

export function getAllowedTransitions(from, role) {
  const targets = TRANSITIONS[from] ?? {};
  return Object.keys(targets).filter((to) => canTransition(from, to, role));
}
