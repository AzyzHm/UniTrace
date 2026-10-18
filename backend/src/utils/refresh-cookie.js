import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_MS,
} from '../constants/refresh-token.js';

// Every cookie rule in one place, so setting and clearing can never drift apart.
// A cookie is cleared only with the same path it was set with.
export function createRefreshCookie({ secure = false } = {}) {
  const base = {
    // JavaScript cannot read it, so an XSS bug cannot steal the session.
    httpOnly: true,
    // HTTPS only in production. Plain http is allowed in development.
    secure,
    // Never sent on a request that starts from another site, which is also
    // the CSRF protection for refresh and logout.
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };

  return {
    read: (req) => req.cookies?.[REFRESH_COOKIE_NAME],
    set: (res, token) =>
      res.cookie(REFRESH_COOKIE_NAME, token, { ...base, maxAge: REFRESH_TOKEN_TTL_MS }),
    clear: (res) => res.clearCookie(REFRESH_COOKIE_NAME, base),
  };
}
