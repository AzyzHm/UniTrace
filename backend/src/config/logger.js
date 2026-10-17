import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  ...(env.nodeEnv === 'development' && {
    transport: { target: 'pino-pretty' },
  }),
});
