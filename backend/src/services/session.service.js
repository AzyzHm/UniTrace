import { REFRESH_TOKEN_TTL_MS } from '../constants/refresh-token.js';
import {
  EmailNotVerifiedError,
  ForbiddenError,
  UnauthenticatedError,
} from '../exceptions/app-error.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_SESSION = 'Invalid or expired session';
const DUMMY_PASSWORD = 'unitrace-dummy-password';

const silentLogger = { warn() {} };

// Everything about a login session: login, refresh and logout. Account
// creation and email verification stay in the auth service.
export function createSessionService({
  userRepository,
  passwordHasher,
  tokenService,
  refreshTokenRepository,
  refreshTokenHasher,
  clock = () => new Date(),
  logger = silentLogger,
}) {
  if (!refreshTokenRepository || !refreshTokenHasher) {
    throw new Error(
      'createSessionService(): refreshTokenRepository and refreshTokenHasher are required',
    );
  }

  // A real hash made by the same hasher, so it has the same cost as real ones.
  // Built once, on first use.
  let dummyHash;
  const getDummyHash = () => {
    dummyHash ??= passwordHasher.hash(DUMMY_PASSWORD);
    return dummyHash;
  };

  // Returns the plain token, which goes to the client once. Only its hash is stored.
  async function issueRefreshToken(userId) {
    const token = refreshTokenHasher.generate();
    await refreshTokenRepository.create({
      userId,
      tokenHash: refreshTokenHasher.hash(token),
      expiresAt: new Date(clock().getTime() + REFRESH_TOKEN_TTL_MS),
    });
    return token;
  }

  // A token that was already used is being shown again. It is either a thief
  // or a stale copy, and we cannot tell which, so every session of this user
  // ends. Safe for the account, and the real user simply logs in again.
  async function revokeAllAndRefuse(userId) {
    await refreshTokenRepository.deleteAllForUser(userId);
    logger.warn({ userId: String(userId) }, 'Refresh token reuse detected, sessions revoked');
    throw new UnauthenticatedError(INVALID_SESSION);
  }

  return {
    async login({ email, password }) {
      const user = await userRepository.findByEmailWithPassword(email);

      // One bcrypt comparison in every case, so an unknown email takes as long
      // as a wrong password and the response time reveals nothing.
      const hash = user ? user.password : await getDummyHash();
      const passwordMatches = await passwordHasher.compare(password, hash);
      if (!user || !passwordMatches) throw new UnauthenticatedError(INVALID_CREDENTIALS);

      // Only after the password is right, so these states are never shown to
      // someone who does not know it.
      if (!user.isEmailVerified) throw new EmailNotVerifiedError();
      if (!user.isActive) throw new ForbiddenError('Your account is suspended');

      return {
        user,
        accessToken: tokenService.signAccessToken(user),
        refreshToken: await issueRefreshToken(user._id),
      };
    },

    async refresh(rawToken) {
      if (typeof rawToken !== 'string' || rawToken === '') {
        throw new UnauthenticatedError(INVALID_SESSION);
      }

      const tokenHash = refreshTokenHasher.hash(rawToken);
      const now = clock();

      const stored = await refreshTokenRepository.findByHash(tokenHash);
      if (!stored) throw new UnauthenticatedError(INVALID_SESSION);

      if (stored.usedAt) return revokeAllAndRefuse(stored.user);
      if (stored.expiresAt.getTime() <= now.getTime()) {
        throw new UnauthenticatedError(INVALID_SESSION);
      }

      // Checked before the token is used up, so a suspended user is refused
      // without losing the session. Reinstating the account then just works.
      const user = await userRepository.findById(stored.user);
      if (!user || user.deletedAt) throw new UnauthenticatedError(INVALID_SESSION);
      if (!user.isActive) throw new ForbiddenError('Your account is suspended');

      // Atomic. If a parallel request used the token between our read and
      // now, we lose, and that counts as reuse.
      const claimed = await refreshTokenRepository.claim({ tokenHash, now });
      if (!claimed) return revokeAllAndRefuse(stored.user);

      return {
        user,
        accessToken: tokenService.signAccessToken(user),
        refreshToken: await issueRefreshToken(user._id),
      };
    },

    // Ends this device's session only. Quiet when there is nothing to end,
    // so logging out twice, or with no cookie, is never an error.
    async logout(rawToken) {
      if (typeof rawToken !== 'string' || rawToken === '') return;
      await refreshTokenRepository.deleteByHash(refreshTokenHasher.hash(rawToken));
    },
  };
}
