import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  ALLOWED_EMAIL_DOMAINS: Joi.string().default('isamm.uma.tn,isamm.u-manouba.tn'),
  AGENTMAIL_API_KEY: Joi.string().empty('').when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
  }),
  AGENTMAIL_INBOX_ID: Joi.string().email().empty('').when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
  }),
  // Signs the stored hash of every verification code, so a leaked database
  // cannot be used to brute-force the 1,000,000 possible codes offline.
  CODE_HASH_SECRET: Joi.string()
    .empty('')
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.any().default('dev-only-code-hash-secret-change-me'),
    }),
}).unknown(true);

export function loadEnv(source = process.env) {
  const { value, error } = schema.validate(source, { abortEarly: false });

  if (error) {
    const lines = error.details.map((detail) => `  - ${detail.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${lines}`);
  }

  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    mongoUri: value.MONGODB_URI,
    allowedEmailDomains: value.ALLOWED_EMAIL_DOMAINS.split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
    agentmail: {
      apiKey: value.AGENTMAIL_API_KEY ?? null,
      inboxId: value.AGENTMAIL_INBOX_ID ?? null,
    },
    codeHashSecret: value.CODE_HASH_SECRET,
  });
}

export const env = loadEnv();
