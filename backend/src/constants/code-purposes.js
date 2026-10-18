// Shared by the email templates and the VerificationCode model, so the
// two can never drift apart.
export const CODE_PURPOSES = Object.freeze({
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
});

export const CODE_PURPOSE_VALUES = Object.freeze(Object.values(CODE_PURPOSES));
