import { toUserResponse } from '../presenters/user.presenter.js';

// Identical for an unknown, an unverified and an already verified address.
const RESEND_MESSAGE =
  'If this address belongs to an unverified account, a new code has been sent.';

export function createAuthController({ authService, sessionService }) {
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
      const { user, accessToken } = await sessionService.login(req.body);
      // A response that carries a token must never be kept by a cache or proxy.
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ accessToken, user: toUserResponse(user) });
    },
  };
}
