import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../exceptions/app-error.js';

// Pinned on both sides. Without the whitelist on verify, a token could pick
// its own algorithm, including "none" (no signature at all).
const ALGORITHM = 'HS256';
const ISSUER = 'unitrace';

export function createTokenService({ secret, expiresIn, clock = () => new Date() }) {
  if (!secret) {
    throw new Error('createTokenService(): secret is required');
  }
  // A missing lifetime would silently issue tokens that never expire.
  if (!expiresIn) {
    throw new Error('createTokenService(): expiresIn is required');
  }

  const nowSeconds = () => Math.floor(clock().getTime() / 1000);

  return {
    // Only the user id. The role and the account state are read from the
    // database on every request, so a token can never carry a stale privilege.
    signAccessToken(user) {
      return jwt.sign({ sub: String(user._id), iat: nowSeconds() }, secret, {
        algorithm: ALGORITHM,
        expiresIn,
        issuer: ISSUER,
      });
    },

    // Every failure (bad signature, expired, wrong issuer, no subject,
    // garbage) is the same error, so a caller learns nothing from the reason.
    verifyAccessToken(token) {
      try {
        const payload = jwt.verify(token, secret, {
          algorithms: [ALGORITHM],
          issuer: ISSUER,
          clockTimestamp: nowSeconds(),
        });
        if (typeof payload.sub !== 'string' || payload.sub === '') {
          throw new Error('Token has no subject');
        }
        return { userId: payload.sub };
      } catch {
        throw new UnauthenticatedError('Invalid or expired token');
      }
    },
  };
}
