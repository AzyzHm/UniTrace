import { ConflictError } from '../exceptions/app-error.js';
import { User } from '../models/user.model.js';

const DUPLICATE_KEY_CODE = 11000;

// Not a bcrypt hash and never one, so no password can match it. The "!"
// follows the Unix convention for a locked account.
const LOCKED_PASSWORD = '!';

const DUPLICATE_MESSAGES = {
  email: 'Email is already used',
  username: 'Username is already taken',
};

// Turns the database's duplicate key error into the API's 409, naming the
// field. Any other error is returned untouched for the caller to rethrow.
function toConflictError(err, message) {
  if (err.code !== DUPLICATE_KEY_CODE) return err;

  const field = Object.keys(err.keyPattern ?? {})[0] ?? 'unknown';
  return new ConflictError(message, [
    { field, message: DUPLICATE_MESSAGES[field] ?? 'Value is already used' },
  ]);
}

export function createUserRepository({ model = User } = {}) {
  return {
    async create(data) {
      try {
        return await model.create(data);
      } catch (err) {
        throw toConflictError(err, 'Account already exists');
      }
    },

    findById(id) {
      return model.findById(id);
    },

    findByEmail(email) {
      return model.findOne({ email });
    },

    // The only query that loads the hash, and only the login path uses it.
    // Every other read keeps the "select: false" protection of the model.
    findByEmailWithPassword(email) {
      return model.findOne({ email }).select('+password');
    },

    // For the one case that needs the hash of an already authenticated user:
    // checking the current password before it is changed.
    findByIdWithPassword(id) {
      return model.findById(id).select('+password');
    },

    // The filter makes the flip atomic and idempotent: it matches only a
    // user who is still unverified, and returns null otherwise.
    markEmailVerified(id) {
      return model.findOneAndUpdate(
        { _id: id, isEmailVerified: false },
        { $set: { isEmailVerified: true } },
        { returnDocument: 'after' },
      );
    },

    // Takes a hash, never a plain password. Returns null for an unknown id.
    updatePassword(id, passwordHash) {
      return model.findOneAndUpdate(
        { _id: id },
        { $set: { password: passwordHash } },
        { returnDocument: 'after' },
      );
    },

    // One atomic update of the fields it is given, so a new email and the
    // "not verified" flag change together or not at all. The caller decides
    // which fields are allowed. Uniqueness is left to the indexes, so two
    // people taking the same email at once cannot both win.
    // Returns null for an unknown id.
    async updateProfile(id, changes) {
      try {
        return await model.findOneAndUpdate(
          { _id: id },
          { $set: changes },
          { returnDocument: 'after', runValidators: true },
        );
      } catch (err) {
        throw toConflictError(err, 'Profile could not be updated');
      }
    },

    // Replaces everything that identifies the person, in one atomic update.
    // The caller chooses the placeholder username and email (they must be
    // unique per user, because both fields have a unique index). The filter
    // matches only a live account, so of two simultaneous deletions exactly
    // one gets a document back and the other gets null.
    //
    // runValidators is off on purpose: "deleted_user_<id>" is longer than the
    // 30 characters the model allows for a username. That is safe, because
    // the register rules cap real usernames at 30, so nobody can ever take
    // such a name, and this is the only write that stores one.
    anonymize(id, { username, email, deletedAt }) {
      return model.findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          $set: {
            username,
            email,
            phone: null,
            password: LOCKED_PASSWORD,
            isEmailVerified: false,
            deletedAt,
          },
        },
        { returnDocument: 'after', runValidators: false },
      );
    },
  };
}
