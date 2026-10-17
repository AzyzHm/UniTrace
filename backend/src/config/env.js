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
  });
}

export const env = loadEnv();
