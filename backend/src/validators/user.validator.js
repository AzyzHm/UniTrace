import Joi from 'joi';
import { confirmPasswordRule, passwordRule } from './auth.validator.js';
import { phoneField, universityEmailField, usernameField } from './user-fields.js';

// Every field is optional, but at least one must be sent. Unknown fields are
// refused by the validate middleware, so "role" or "isEmailVerified" in the
// body is a 400 and never reaches the service.
export function createUpdateProfileSchema({ allowedEmailDomains }) {
  return Joi.object({
    username: usernameField(),
    email: universityEmailField({ allowedEmailDomains }),
    // null removes the phone number. "" is refused, so there is one way to clear it.
    phone: phoneField().allow(null),
  })
    .min(1)
    .messages({ 'object.min': 'Send at least one field to update' });
}

export const changePasswordSchema = Joi.object({
  // No strength rules and no trim, like login: an older password must still
  // be accepted here. Max 72 keeps absurd inputs away from bcrypt.
  currentPassword: Joi.string().max(72).required(),
  // Same rules as register and reset, plus: it must really be a change.
  newPassword: passwordRule()
    .invalid(Joi.ref('currentPassword'))
    .messages({ 'any.invalid': 'New password must be different from the current password' }),
  confirmPassword: confirmPasswordRule('newPassword'),
});

// The password is asked again so a stolen access token, or a phone left
// unlocked, cannot erase an account. No strength rules and no trim, like
// login: the stored password may be an older one.
export const deleteAccountSchema = Joi.object({
  password: Joi.string().max(72).required(),
});
