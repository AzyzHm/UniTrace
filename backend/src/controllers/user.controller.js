import { toUserResponse } from '../presenters/user.presenter.js';
import { VERIFICATION } from '../services/profile.service.js';

const MESSAGES = Object.freeze({
  [VERIFICATION.SENT]:
    'Your email address was changed. Enter the code sent to the new address to verify it.',
  [VERIFICATION.NOT_SENT]:
    'Your email address was changed, but the verification code could not be sent. Request a new code in a moment.',
});

const PASSWORD_CHANGED_MESSAGE =
  'Your password has been changed. Your other devices were logged out.';

export function createUserController({
  profileService,
  passwordChangeService,
  accountDeletionService,
  refreshCookie,
}) {
  const dependencies = {
    profileService,
    passwordChangeService,
    accountDeletionService,
    refreshCookie,
  };
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (!dependency) {
      throw new Error(`createUserController(): ${name} is required`);
    }
  }

  return {
    // requireAuth already loaded the user, so there is nothing to compute.
    me(req, res) {
      res.status(200).json({ user: toUserResponse(req.user) });
    },

    async updateMe(req, res) {
      const { user, verification } = await profileService.updateProfile(req.user, req.body);

      const body = { user: toUserResponse(user) };
      // Only when the email changed. user.isEmailVerified is false in both cases.
      if (MESSAGES[verification]) body.message = MESSAGES[verification];

      res.status(200).json(body);
    },

    async changePassword(req, res) {
      const { refreshToken } = await passwordChangeService.changePassword(req.user, req.body);

      // This device stays logged in with a new refresh token, and every other
      // session of the user is gone. The cookie path is /api/v1/auth even though
      // this route is under /users, so it replaces the old cookie.
      refreshCookie.set(res, refreshToken);
      // A response that sets a session must never be kept by a cache or proxy.
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ message: PASSWORD_CHANGED_MESSAGE });
    },

    async deleteMe(req, res) {
      await accountDeletionService.deleteAccount(req.user, req.body);

      // Every session of the user just ended, including this browser's, so its
      // cookie is dead. Removing it saves the browser a refresh that fails.
      refreshCookie.clear(res);
      res.status(204).end();
    },
  };
}
