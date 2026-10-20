import cookieParser from 'cookie-parser';
import express from 'express';
import { notFoundHandler } from './middlewares/not-found.js';
import { createErrorHandler } from './middlewares/error-handler.js';
import { createApiRouter } from './routes/index.js';

const silentLogger = { error() {}, warn() {}, info() {}, debug() {} };

export function createApp({
  logger = silentLogger,
  authService,
  sessionService,
  passwordResetService,
  profileService,
  passwordChangeService,
  requireAuth,
  allowedEmailDomains,
  secureCookies = false,
} = {}) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(
    '/api/v1',
    createApiRouter({
      authService,
      sessionService,
      passwordResetService,
      profileService,
      passwordChangeService,
      requireAuth,
      allowedEmailDomains,
      secureCookies,
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger }));

  return app;
}
