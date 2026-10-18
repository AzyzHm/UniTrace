import { UnauthenticatedError } from '../exceptions/app-error.js';
import { toUserResponse } from '../presenters/user.presenter.js';

// Identical for an unknown, an unverified and an already verified address.
const RESEND_MESSAGE =
  'If this address belongs to an unverified account, a new code has been sent.';

export function createAuthController({ authService, sessionService, refreshCookie }) {
  // Login and refresh answer the same way: the refresh token goes into the
  // cookie only, the access token and the user go into the body.
  function sendSession(res, { user, accessToken, refreshToken }) {
    refreshCookie.set(res, refreshToken);
    // A response that carries a token must never be kept by a cache or proxy.
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ accessToken, user: toUserResponse(user) });
  }

  return {
    async register(req, res) {
      const user = await authService.register(req.body);
      res.status(201).json({ user: toUserResponse(user) });
    },

    async verifyEmail(req, res) {
      const user = await authService.verifyEmail(req.body);
      res.status(200).json({ user: toUserResponse(user) });
    },

    async resendVerification(req, res) {
      await authService.resendVerification(req.body);
      res.status(200).json({ message: RESEND_MESSAGE });
    },

    async login(req, res) {
      sendSession(res, await sessionService.login(req.body));
    },

    async refresh(req, res) {
      try {
        sendSession(res, await sessionService.refresh(refreshCookie.read(req)));
      } catch (err) {
        // A dead cookie is removed so the browser stops sending it. Only for a
        // 401: a suspended account (403) or a server fault must keep the cookie.
        if (err instanceof UnauthenticatedError) refreshCookie.clear(res);
        throw err;
      }
    },

    async logout(req, res) {
      await sessionService.logout(refreshCookie.read(req));
      refreshCookie.clear(res);
      res.status(204).end();
    },
  };
}
