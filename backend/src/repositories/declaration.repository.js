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

    // Sets the given fields and returns the declaration as it is now, with its
    // privateInfo (the caller is the owner or an admin). The filter repeats
    // the status the caller based its decision on: if the status moved in the
    // meantime (an admin hid it, the owner deleted it), nothing is written and
    // the answer is null. updatedAt is refreshed by Mongoose, and the model
    // rules (lengths, enums) are checked again on the update.
    updateFields(id, fields, expectedStatus) {
      return model
        .findOneAndUpdate(
          { _id: id, status: expectedStatus },
          { $set: fields },
          { returnDocument: 'after', runValidators: true },
        )
        .select('+privateInfo');
    },

    // One page of the owner's declarations, newest first, plus the total
    // that matches the filters (the client needs it to draw the pages).
    // A soft deleted declaration is never listed. Without a status filter that
    // is "not deleted", with one it is exactly that status. The _id in the
    // sort breaks ties, so two declarations created in the same millisecond
    // never swap places between page 1 and page 2. lean() returns plain
    // objects: nothing here will be saved, and privateInfo stays unloaded.
    async findPageByOwner(ownerId, { type, status, skip, limit }) {
      const filter = {
        owner: ownerId,
        status: status ?? { $ne: DECLARATION_STATUSES.DELETED },
      };
      if (type) filter.type = type;

      const [items, total] = await Promise.all([
        model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        model.countDocuments(filter),
      ]);

      return { items, total };
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
