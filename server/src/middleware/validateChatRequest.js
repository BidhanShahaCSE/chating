const ALLOWED_ROLES = new Set(['user', 'assistant']);
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 32000;
const MAX_TOTAL_CHARS = 250000;

/**
 * Validates incoming chat completion payloads before calling Gemini.
 */
export function validateChatRequest(req, res, next) {
  const { messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must include a non-empty "messages" array.',
      },
    });
  }

  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Conversation history exceeds the maximum of ${MAX_MESSAGES} messages per request.`,
      },
    });
  }

  let totalChars = 0;
  const normalizedMessages = [];

  for (let i = 0; i < messages.length; i += 1) {
    const item = messages[i];
    if (!item || typeof item !== 'object') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Message at index ${i} must be an object with "role" and "content".`,
        },
      });
    }

    const { role, content } = item;
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Message at index ${i} has an invalid role. Allowed roles: user, assistant.`,
        },
      });
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Message at index ${i} must contain non-empty text content.`,
        },
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Message at index ${i} exceeds the ${MAX_MESSAGE_LENGTH}-character limit.`,
        },
      });
    }

    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Total conversation payload is too large for a single request.',
        },
      });
    }

    normalizedMessages.push({
      role,
      content: content.trim(),
    });
  }

  if (normalizedMessages[normalizedMessages.length - 1].role !== 'user') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The latest message in the conversation must have role "user".',
      },
    });
  }

  req.validatedMessages = normalizedMessages;
  return next();
}
