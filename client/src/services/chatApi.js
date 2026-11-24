export class ChatApiError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', status = 500) {
    super(message);
    this.name = 'ChatApiError';
    this.code = code;
    this.status = status;
  }
}

export async function fetchHealthStatus({ signal } = {}) {
  const response = await fetch('/api/health', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new ChatApiError('Failed to query server health status.', 'HEALTH_ERROR', response.status);
  }

  return response.json();
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const rawData = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return { event, data: { text: rawData } };
  }
}

/**
 * Streams a multi-turn Gemini completion from the backend SSE endpoint.
 */
export async function streamChatResponse({ messages, signal, onMeta, onDelta, onDone }) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    }),
    signal,
  });

  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }

    const message =
      errorBody?.error?.message ||
      `Request failed with HTTP ${response.status}. Please try again.`;
    const code = errorBody?.error?.code || 'REQUEST_FAILED';
    throw new ChatApiError(message, code, response.status);
  }

  if (!response.body) {
    throw new ChatApiError('Server response did not include a readable stream.', 'EMPTY_STREAM', 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedDone = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const trimmed = frame.trim();
      if (!trimmed) continue;

      const parsed = parseSseBlock(trimmed);
      if (!parsed) continue;

      if (parsed.event === 'meta') {
        onMeta?.(parsed.data);
      } else if (parsed.event === 'delta' && parsed.data?.text) {
        onDelta?.(parsed.data.text);
      } else if (parsed.event === 'error') {
        throw new ChatApiError(
          parsed.data?.message || 'An error occurred while streaming the response.',
          parsed.data?.code || 'STREAM_ERROR',
          502,
        );
      } else if (parsed.event === 'done') {
        receivedDone = true;
        onDone?.(parsed.data);
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer.trim());
    if (parsed?.event === 'delta' && parsed.data?.text) {
      onDelta?.(parsed.data.text);
    } else if (parsed?.event === 'error') {
      throw new ChatApiError(
        parsed.data?.message || 'An error occurred while streaming the response.',
        parsed.data?.code || 'STREAM_ERROR',
        502,
      );
    } else if (parsed?.event === 'done') {
      receivedDone = true;
      onDone?.(parsed.data);
    }
  }

  if (!receivedDone && !signal?.aborted) {
    onDone?.({});
  }
}
