import rateLimit from 'express-rate-limit';

/**
 * Creates rate-limiting middleware for API endpoints.
 */
export function createRateLimiters(options = {}) {
  const apiLimiter = rateLimit({
    windowMs: options.apiWindowMs ?? 60 * 1000,
    limit: options.apiLimit ?? 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests from this client. Please slow down and try again shortly.',
      },
    },
  });

  const chatLimiter = rateLimit({
    windowMs: options.chatWindowMs ?? 60 * 1000,
    limit: options.chatLimit ?? 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Chat rate limit reached. Please wait a moment before sending another message.',
      },
    },
  });

  return { apiLimiter, chatLimiter };
}
