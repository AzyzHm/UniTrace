import { toUserResponse } from '../presenters/user.presenter.js';

export function createUserController() {
  return {
    // requireAuth already loaded the user, so there is nothing to compute.
    me(req, res) {
      res.status(200).json({ user: toUserResponse(req.user) });
    },
  };
}
