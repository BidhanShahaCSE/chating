import { Router } from 'express';
import { getPublicConfig } from '../config/env.js';
import { validateChatRequest } from '../middleware/validateChatRequest.js';
import {
  classifyGeminiError,
  createGeminiStream,
  extractChunkText,
} from '../services/geminiService.js';

function writeSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Mounts chat and health routes backed by the active runtime configuration.
 */
export function createChatRouter({ getRuntimeConfig, aiClientFactory, chatLimiter }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    const config = getRuntimeConfig();
    res.json({
      status: 'ok',
      ...getPublicConfig(config),
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/chat/stream', chatLimiter, validateChatRequest, async (req, res) => {
    const config = getRuntimeConfig();

    if (!config.isConfigured) {
      return res.status(503).json({
        error: {
          code: 'MISSING_API_KEY',
          message:
            'Gemini API key is not configured. Open the .env file in the project root, set GEMINI_API_KEY=<your-key>, and restart the server.',
        },
      });
    }

    const abortController = new AbortController();
    let clientDisconnected = false;

    const handleClientClose = () => {
      if (!res.writableFinished) {
        clientDisconnected = true;
        abortController.abort();
      }
    };

    res.on('close', handleClientClose);

    let responseStream;
    try {
      responseStream = await createGeminiStream({
        apiKey: config.apiKey,
        model: config.model,
        messages: req.validatedMessages,
        signal: abortController.signal,
        aiClientFactory,
      });
    } catch (error) {
      res.off('close', handleClientClose);
      const mapped = classifyGeminiError(error);
      if (mapped.code === 'ABORTED' || clientDisconnected) {
        return res.end();
      }
      return res.status(mapped.status).json({
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    writeSseEvent(res, 'meta', { model: config.model });

    try {
      for await (const chunk of responseStream) {
        if (abortController.signal.aborted || clientDisconnected) {
          break;
        }
        const text = extractChunkText(chunk);
        if (text) {
          writeSseEvent(res, 'delta', { text });
        }
      }

      if (!abortController.signal.aborted && !clientDisconnected) {
        writeSseEvent(res, 'done', { model: config.model });
      }
    } catch (error) {
      const mapped = classifyGeminiError(error);
      if (mapped.code !== 'ABORTED' && !clientDisconnected) {
        writeSseEvent(res, 'error', {
          code: mapped.code,
          message: mapped.message,
        });
      }
    } finally {
      res.off('close', handleClientClose);
      if (!res.writableEnded) {
        res.end();
      }
    }

    return undefined;
  });

  return router;
}
