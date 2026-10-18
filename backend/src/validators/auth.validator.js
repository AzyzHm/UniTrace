import Joi from 'joi';
import { CODE_LENGTH } from '../constants/verification-code.js';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);
const emailFormat = Joi.string().email();

// Exact match on the part after the LAST "@". endsWith would accept
// "isamm.uma.tn.evil.com" style tricks, and a subdomain is not the university.
export function isAllowedEmailDomain(email, allowedDomains) {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return allowedDomains.includes(domain);
}

export function createRegisterSchema({ allowedEmailDomains }) {
  return Joi.object({
    username: Joi.string().trim().min(3).max(30).pattern(USERNAME_PATTERN).required().messages({
      'string.pattern.base': 'Username can only contain letters, digits, "_" and "."',
    }),

    email: Joi.string()
      .trim()
      .lowercase()
      .email()
      .required()
      .custom((value, helpers) => {
        // A malformed email already has its own error, do not add a second one.
        if (emailFormat.validate(value).error) return value;

        return isAllowedEmailDomain(value, allowedEmailDomains)
          ? value
          : helpers.error('domain.notAllowed');
      })
      .messages({ 'domain.notAllowed': 'Please use your university email address' }),

    phone: Joi.string().trim().pattern(PHONE_PATTERN).optional().messages({
      'string.pattern.base': 'Phone must be 8 to 15 digits, optionally starting with "+"',
    }),

    // Max 72: bcrypt silently ignores everything after 72 bytes, so a longer
    // limit would give a false sense of security.
    password: Joi.string().min(8).max(72).pattern(PASSWORD_PATTERN).required().messages({
      'string.pattern.base': 'Password must contain at least one letter and one digit',
    }),

    // .strip() removes it from the validated value, so the service never sees it.
    confirmPassword: Joi.any()
      .valid(Joi.ref('password'))
      .required()
      .strip()
      .messages({ 'any.only': 'Passwords do not match' }),
  });
}

// No domain check here: an address outside the allowed domains has no account,
// so it simply finds nothing. Only the format matters, to stop junk early.
const emailField = () => Joi.string().trim().lowercase().email().required();

export const verifyEmailSchema = Joi.object({
  email: emailField(),
  // A string, so a leading zero survives ("012345" must not become 12345).
  code: Joi.string()
    .trim()
    .pattern(CODE_PATTERN)
    .required()
    .messages({
      'string.pattern.base': `Code must be ${CODE_LENGTH} digits`,
    }),
});

export const resendVerificationSchema = Joi.object({
  email: emailField(),
});

export const loginSchema = Joi.object({
  email: emailField(),
  // No strength rules and no trim: the rules apply when a password is chosen,
  // and an older password must keep working. Max 72 matches bcrypt and keeps
  // absurd inputs away from the hash function.
  password: Joi.string().max(72).required(),
});
