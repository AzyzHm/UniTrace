import { toUserResponse } from '../presenters/user.presenter.js';
import { VERIFICATION } from '../services/profile.service.js';

const MESSAGES = Object.freeze({
  [VERIFICATION.SENT]:
    'Your email address was changed. Enter the code sent to the new address to verify it.',
  [VERIFICATION.NOT_SENT]:
    'Your email address was changed, but the verification code could not be sent. Request a new code in a moment.',
});

export function createUserController({ profileService }) {
  if (!profileService) {
    throw new Error('createUserController(): profileService is required');
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
  };
}
