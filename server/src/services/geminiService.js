import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = [
  'You are Chating, a helpful, accurate, and thoughtful AI assistant.',
  'Format responses clearly with Markdown when appropriate, and specify language identifiers on fenced code blocks.',
].join(' ');

/**
 * Converts client chat history into the Google Gen AI multi-turn `contents` array.
 */
export function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

function sanitizeErrorDetails(text) {
  if (!text) return '';
  return String(text)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_KEY]')
    .replace(/(key|api_key|apiKey)=([^\s&"']+)/gi, '$1=[REDACTED]');
}

/**
 * Maps Gemini SDK and network failures into safe HTTP status codes and user-facing messages.
 */
export function classifyGeminiError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const rawMessage = sanitizeErrorDetails(error?.message || '');
  const lower = rawMessage.toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();

  if (
    error?.name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    lower.includes('aborted')
  ) {
    return {
      status: 499,
      code: 'ABORTED',
      message: 'Generation stopped.',
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied')
  ) {
    return {
      status: 401,
      code: 'INVALID_API_KEY',
      message:
        'Your Gemini API key appears invalid or lacks permission for this model. Double-check GEMINI_API_KEY in .env and restart the server.',
    };
  }

  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Gemini API quota or rate limit exceeded. Wait a moment before retrying or review your quota in Google AI Studio.',
    };
  }

  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('not supported for generatecontent')
  ) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message:
        'The configured Gemini model could not be found or is unavailable. Check GEMINI_MODEL in .env (default: gemini-4-hydrogen).',
    };
  }

  if (status === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      code: 'BAD_REQUEST',
      message:
        'The Gemini API rejected the conversation payload. Try starting a new chat or shortening the message.',
    };
  }

  if (
    ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET'].includes(code) ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return {
      status: 502,
      code: 'NETWORK_ERROR',
      message:
        'Could not connect to the Gemini API. Check your internet connection and try again.',
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message:
      'The Gemini API encountered an unexpected error while generating a response. Please try again.',
  };
}

/**
 * Initiates a streaming content generation call using the official @google/genai SDK.
 */
export async function createGeminiStream({
  apiKey,
  model,
  messages,
  signal,
  aiClientFactory,
}) {
  if (!apiKey) {
    const err = new Error('Missing Gemini API key');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const ai = aiClientFactory ? aiClientFactory(apiKey) : new GoogleGenAI({ apiKey });

  return ai.models.generateContentStream({
    model,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      abortSignal: signal,
    },
  });
}

/**
 * Extracts streamed text safely from a Gemini response chunk.
 */
export function extractChunkText(chunk) {
  if (!chunk) return '';
  if (typeof chunk.text === 'function') {
    return chunk.text() || '';
  }
  return typeof chunk.text === 'string' ? chunk.text : '';
}
