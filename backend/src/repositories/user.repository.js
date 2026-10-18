import { ConflictError } from '../exceptions/app-error.js';
import { User } from '../models/user.model.js';

const DUPLICATE_KEY_CODE = 11000;

const DUPLICATE_MESSAGES = {
  email: 'Email is already used',
  username: 'Username is already taken',
};

export function createUserRepository({ model = User } = {}) {
  return {
    async create(data) {
      try {
        return await model.create(data);
      } catch (err) {
        if (err.code === DUPLICATE_KEY_CODE) {
          const field = Object.keys(err.keyPattern ?? {})[0] ?? 'unknown';
          throw new ConflictError('Account already exists', [
            { field, message: DUPLICATE_MESSAGES[field] ?? 'Value is already used' },
          ]);
        }
        throw err;
      }
    },
  };
}
