import Joi from 'joi';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
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
