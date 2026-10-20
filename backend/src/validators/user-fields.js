import Joi from 'joi';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const emailFormat = Joi.string().email();

// Exact match on the part after the LAST "@". endsWith would accept
// "isamm.uma.tn.evil.com" style tricks, and a subdomain is not the university.
export function isAllowedEmailDomain(email, allowedDomains) {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return allowedDomains.includes(domain);
}

// The rules for the three profile fields, shared by register and by the
// profile update, so the two can never drift apart. None of them says
// "required": that is the job of the schema that uses them.

export const usernameField = () =>
  Joi.string().trim().min(3).max(30).pattern(USERNAME_PATTERN).messages({
    'string.pattern.base': 'Username can only contain letters, digits, "_" and "."',
  });

export const phoneField = () =>
  Joi.string().trim().pattern(PHONE_PATTERN).messages({
    'string.pattern.base': 'Phone must be 8 to 15 digits, optionally starting with "+"',
  });

export const universityEmailField = ({ allowedEmailDomains }) =>
  Joi.string()
    .trim()
    .lowercase()
    .email()
    .custom((value, helpers) => {
      // A malformed email already has its own error, do not add a second one.
      if (emailFormat.validate(value).error) return value;

      return isAllowedEmailDomain(value, allowedEmailDomains)
        ? value
        : helpers.error('domain.notAllowed');
    })
    .messages({ 'domain.notAllowed': 'Please use your university email address' });
