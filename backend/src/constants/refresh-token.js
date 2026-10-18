export const REFRESH_TOKEN_TTL_DAYS = 30;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = 'refreshToken';
// The browser sends the cookie only to the auth routes, never to /declarations
// or /users, which shrinks the places where it can leak.
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
