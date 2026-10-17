export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

// "system" is not a user role. It is the actor used by background logic
// (matching, expiry job), so it never appears in a User document.
export const SYSTEM_ACTOR = 'system';

export function isAdminRole(role) {
  return role === ROLES.ADMIN;
}
