import { ForbiddenError, UnauthenticatedError } from '../exceptions/app-error.js';

// Scheme names are case-insensitive (RFC 9110), the token itself is not.
const BEARER = /^Bearer\s+(\S+)$/i;

export function createRequireAuth({ tokenService, userRepository }) {
  // Express 5 sends a thrown error or a rejected promise to the error handler,
  // so there is no try/catch and no next(err) here.
  return async function requireAuth(req, res, next) {
    const match = BEARER.exec(req.get('Authorization') ?? '');
    if (!match) throw new UnauthenticatedError();

    const { userId } = tokenService.verifyAccessToken(match[1]);

    // The user is read on every request, on purpose. A suspension, a deletion
    // or a role change takes effect at once instead of when the token expires.
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt) throw new UnauthenticatedError('Invalid or expired token');
    if (!user.isActive) throw new ForbiddenError('Your account is suspended');

    req.user = user;
    next();
  };
}
