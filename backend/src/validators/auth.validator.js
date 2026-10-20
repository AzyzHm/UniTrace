import Joi from 'joi';
import { CODE_LENGTH } from '../constants/verification-code.js';
import { phoneField, universityEmailField, usernameField } from './user-fields.js';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const CODE_PATTERN = new RegExp(`^\\d{${CODE_LENGTH}}$`);

// One definition of "a password someone may choose", used by register and by
// reset, so the two can never drift apart.
// Max 72: bcrypt silently ignores everything after 72 bytes, so a longer
// limit would give a false sense of security.
export const passwordRule = () =>
  Joi.string().min(8).max(72).pattern(PASSWORD_PATTERN).required().messages({
    'string.pattern.base': 'Password must contain at least one letter and one digit',
  });

// .strip() removes it from the validated value, so the service never sees it.
export const confirmPasswordRule = (passwordField) =>
  Joi.any()
    .valid(Joi.ref(passwordField))
    .required()
    .strip()
    .messages({ 'any.only': 'Passwords do not match' });

// No domain check here: an address outside the allowed domains has no account,
// so it simply finds nothing. Only the format matters, to stop junk early.
const emailField = () => Joi.string().trim().lowercase().email().required();

// A string, so a leading zero survives ("012345" must not become 12345).
const codeField = () =>
  Joi.string()
    .trim()
    .pattern(CODE_PATTERN)
    .required()
    .messages({
      'string.pattern.base': `Code must be ${CODE_LENGTH} digits`,
    });

export function createRegisterSchema({ allowedEmailDomains }) {
  return Joi.object({
    username: usernameField().required(),
    email: universityEmailField({ allowedEmailDomains }).required(),
    phone: phoneField().optional(),

    password: passwordRule(),
    confirmPassword: confirmPasswordRule('password'),
  });
}

export const verifyEmailSchema = Joi.object({
  email: emailField(),
  code: codeField(),
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

export const forgotPasswordSchema = Joi.object({
  email: emailField(),
});

export const resetPasswordSchema = Joi.object({
  email: emailField(),
  code: codeField(),
  // "newPassword", not "password", so it can never be mistaken for a login.
  newPassword: passwordRule(),
  confirmPassword: confirmPasswordRule('newPassword'),
});
