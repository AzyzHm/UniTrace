import { REFRESH_TOKEN_TTL_MS } from '../constants/refresh-token.js';
import { UnauthenticatedError, ValidationError } from '../exceptions/app-error.js';

export function createPasswordChangeService({
  userRepository,
  passwordHasher,
  refreshTokenRepository,
  refreshTokenHasher,
  clock = () => new Date(),
}) {
  const dependencies = {
    userRepository,
    passwordHasher,
    refreshTokenRepository,
    refreshTokenHasher,
  };
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency) {
      throw new Error(`createPasswordChangeService(): ${name} is required`);
    }
  }

  return {
    // "user" is the connected user loaded by requireAuth. Returns the new
    // refresh token of THIS device, which the controller puts in the cookie.
    async changePassword(user, { currentPassword, newPassword }) {
      // requireAuth does not load the hash, so it is read here, and only here.
      const stored = await userRepository.findByIdWithPassword(user._id);
      if (!stored) throw new UnauthenticatedError('Invalid or expired token');

      // A 400 on the field, not a 401: the user IS authenticated, and a 401
      // would make a client think its token expired and start a refresh.
      const matches = await passwordHasher.compare(currentPassword, stored.password);
      if (!matches) {
        throw new ValidationError('Invalid input', [
          { field: 'currentPassword', message: 'Current password is incorrect' },
        ]);
      }

      const passwordHash = await passwordHasher.hash(newPassword);
      const updated = await userRepository.updatePassword(user._id, passwordHash);
      if (!updated) throw new UnauthenticatedError('Invalid or expired token');

      // After the password changed, never before, like the reset. Every
      // session ends, then this device gets a new one. The refresh cookie is
      // only sent to /auth routes, so this route cannot tell which session is
      // "this one": starting a fresh one is the reliable way to keep it.
      await refreshTokenRepository.deleteAllForUser(user._id);

      const refreshToken = refreshTokenHasher.generate();
      await refreshTokenRepository.create({
        userId: user._id,
        tokenHash: refreshTokenHasher.hash(refreshToken),
        expiresAt: new Date(clock().getTime() + REFRESH_TOKEN_TTL_MS),
      });

      return { refreshToken };
    },
  };
}
