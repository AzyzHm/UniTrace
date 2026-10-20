import { EVENTS } from '../constants/events.js';
import { UnauthenticatedError, ValidationError } from '../exceptions/app-error.js';

const silentLogger = { error() {} };

export function createAccountDeletionService({
  userRepository,
  passwordHasher,
  refreshTokenRepository,
  verificationCodeRepository,
  eventBus,
  clock = () => new Date(),
  logger = silentLogger,
}) {
  const dependencies = {
    userRepository,
    passwordHasher,
    refreshTokenRepository,
    verificationCodeRepository,
    eventBus,
  };
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency) {
      throw new Error(`createAccountDeletionService(): ${name} is required`);
    }
  }

  // Leftovers that can no longer be used: requireAuth and refresh both refuse
  // a deleted user. So a failure here must not turn a deletion that already
  // happened into an error. It is logged, and the TTL indexes remove the rest.
  async function removeLeftovers(userId) {
    const results = await Promise.allSettled([
      refreshTokenRepository.deleteAllForUser(userId),
      verificationCodeRepository.deleteAllForUser(userId),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error(
          { err: result.reason, userId: String(userId) },
          'Cleanup after account deletion failed',
        );
      }
    }
  }

  return {
    // "user" is the connected user loaded by requireAuth.
    async deleteAccount(user, { password }) {
      // requireAuth does not load the hash, so it is read here, and only here.
      const stored = await userRepository.findByIdWithPassword(user._id);
      if (!stored) throw new UnauthenticatedError('Invalid or expired token');

      // A 400 on the field, not a 401: the user IS authenticated, and a 401
      // would make a client think its token expired and start a refresh.
      const matches = await passwordHasher.compare(password, stored.password);
      if (!matches) {
        throw new ValidationError('Invalid input', [
          { field: 'password', message: 'Password is incorrect' },
        ]);
      }

      // The id makes both values unique, which the unique indexes require.
      // The ".invalid" domain is reserved (RFC 2606) and can never receive
      // mail or be typed into a login form.
      const id = String(user._id);
      const deletedAt = clock();
      const anonymized = await userRepository.anonymize(user._id, {
        username: `deleted_user_${id}`,
        email: `deleted_${id}@deleted.invalid`,
        deletedAt,
      });
      // Null means a parallel request deleted the account first.
      if (!anonymized) throw new UnauthenticatedError('Invalid or expired token');

      // Right after the change, before any cleanup that could fail: this is the
      // fact other parts of the app must hear about. It never throws.
      await eventBus.emit(EVENTS.USER_DELETED, { userId: id, deletedAt });

      await removeLeftovers(user._id);
    },
  };
}
