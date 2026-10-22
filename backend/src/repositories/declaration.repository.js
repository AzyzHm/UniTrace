import { DECLARATION_STATUSES } from '../constants/declaration-status.js';
import { Declaration } from '../models/declaration.model.js';

export function createDeclarationRepository({ model = Declaration } = {}) {
  return {
    create(data) {
      return model.create(data);
    },

    // privateInfo is left out by the model. Every read that is not the
    // owner's or an admin's must use this one.
    findById(id) {
      return model.findById(id);
    },

    // Only for the owner and admins, after the service checked who is asking.
    findByIdWithPrivateInfo(id) {
      return model.findById(id).select('+privateInfo');
    },

    // Soft deletes every declaration of the owner that is in one of the given
    // statuses, and returns what it changed as [{ id, from }], so the caller
    // can announce each change. Two steps (find, then update by id) because
    // updateMany cannot tell which documents it touched. The update repeats
    // the status filter, so a declaration that moved in between is left alone.
    async softDeleteByOwner(ownerId, fromStatuses, deletedAt) {
      const targets = await model
        .find({ owner: ownerId, status: { $in: fromStatuses } })
        .select('status')
        .lean();
      if (targets.length === 0) return [];

      await model.updateMany(
        { _id: { $in: targets.map((t) => t._id) }, status: { $in: fromStatuses } },
        { $set: { status: DECLARATION_STATUSES.DELETED, deletedAt } },
      );

      return targets.map((t) => ({ id: String(t._id), from: t.status }));
    },

    // Erases the hidden detail of every declaration of the owner, whatever its
    // status. Returns how many documents changed.
    async clearPrivateInfoByOwner(ownerId) {
      const result = await model.updateMany(
        { owner: ownerId, privateInfo: { $ne: null } },
        { $set: { privateInfo: null } },
      );
      return result.modifiedCount;
    },
  };
}
