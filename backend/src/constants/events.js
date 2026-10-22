// Names of the events the app emits. One place, so an emitter and a listener
// can never disagree on a spelling.
//
// The payload of each event is part of the contract with the other binomes.
// ids are always strings, never ObjectId, so a listener never depends on Mongoose.
//
//   user.deleted                { userId, deletedAt }
//   declaration.created         { declarationId, ownerId, type, category }
//   declaration.updated         { declarationId, ownerId, changedFields }
//   declaration.statusChanged   { declarationId, ownerId, from, to, actor, reason? }
//
// "actor" is a role (user, admin) or SYSTEM_ACTOR. "reason" is only set when
// the change has no human behind it, for example "owner_deleted".
export const EVENTS = Object.freeze({
  USER_DELETED: 'user.deleted',
  DECLARATION_CREATED: 'declaration.created',
  DECLARATION_UPDATED: 'declaration.updated',
  DECLARATION_STATUS_CHANGED: 'declaration.statusChanged',
});
