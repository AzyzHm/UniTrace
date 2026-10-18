import express from 'express';
import { notFoundHandler } from './middlewares/not-found.js';
import { createErrorHandler } from './middlewares/error-handler.js';
import { createApiRouter } from './routes/index.js';

const silentLogger = { error() {}, warn() {}, info() {}, debug() {} };

export function createApp({ logger = silentLogger, authService, allowedEmailDomains } = {}) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1', createApiRouter({ authService, allowedEmailDomains }));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger }));

  return app;
}
