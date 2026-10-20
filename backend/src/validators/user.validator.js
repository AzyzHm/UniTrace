import Joi from 'joi';
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
