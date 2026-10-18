import { toUserResponse } from '../presenters/user.presenter.js';

export function createAuthController({ authService }) {
  return {
    async register(req, res) {
      const user = await authService.register(req.body);
      res.status(201).json({ user: toUserResponse(user) });
    },
  };
}
