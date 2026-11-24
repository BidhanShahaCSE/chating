import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getConfig } from './config/env.js';
import { createRateLimiters } from './middleware/rateLimiter.js';
import { createChatRouter } from './routes/chatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

/**
 * Creates the Express application with configurable dependencies for testing and production.
 */
export function createApp(options = {}) {
  const app = express();
  const getRuntimeConfig = options.getRuntimeConfig ?? (() => getConfig(options.configOverrides));
  const initialConfig = getRuntimeConfig();

  const { apiLimiter, chatLimiter } = createRateLimiters(options.rateLimit);

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  const allowedOrigins = new Set([
    initialConfig.clientOrigin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    `http://localhost:${initialConfig.port}`,
    `http://127.0.0.1:${initialConfig.port}`,
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
    }),
  );

  app.use(express.json({ limit: '512kb' }));

  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body contains malformed JSON.',
        },
      });
    }
    if (error?.message === 'Origin not allowed by CORS') {
      return res.status(403).json({
        error: {
          code: 'CORS_FORBIDDEN',
          message: 'Cross-origin request blocked.',
        },
      });
    }
    return next(error);
  });

  app.use('/api', apiLimiter);
  app.use(
    '/api',
    createChatRouter({
      getRuntimeConfig,
      aiClientFactory: options.aiClientFactory,
      chatLimiter,
    }),
  );

  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found.',
      },
    });
  });

  const clientDistDir = options.clientDistDir ?? DEFAULT_CLIENT_DIST;
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  return app;
}
