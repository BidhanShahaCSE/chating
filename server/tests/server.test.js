import assert from 'node:assert/strict';
import http from 'node:http';
import { after, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

async function startTestServer(appOptions = {}) {
  const app = createApp(appOptions);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function parseSseFrames(rawText) {
  return rawText
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data += line.slice(5).trim();
        }
      }
      return { event, data: data ? JSON.parse(data) : null };
    });
}

describe('Chating backend API', () => {
  const closers = [];

  after(async () => {
    await Promise.all(closers.map((close) => close()));
  });

  it('reports unconfigured health status safely when GEMINI_API_KEY is missing', async () => {
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: '',
        isConfigured: false,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.configured, false);
    assert.equal(body.model, 'gemini-4-hydrogen');
    assert.equal(body.defaultModel, 'gemini-4-hydrogen');
    assert.equal('apiKey' in body, false);
  });

  it('never leaks API key in health response when configured', async () => {
    const fakeSecret = 'AIzaSyFakeTestSecretKey1234567890';
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: fakeSecret,
        isConfigured: true,
        model: 'gemini-3.8-flash',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/api/health`);
    const rawText = await res.text();
    assert.equal(res.status, 200);
    assert.equal(rawText.includes(fakeSecret), false);
    const body = JSON.parse(rawText);
    assert.equal(body.configured, true);
    assert.equal(body.model, 'gemini-3.8-flash');
  });

  it('returns 503 MISSING_API_KEY without dummy responses when key is empty', async () => {
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: '',
        isConfigured: false,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error.code, 'MISSING_API_KEY');
    assert.match(body.error.message, /GEMINI_API_KEY/);
  });

  it('validates malformed chat request payloads', async () => {
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: 'test-key',
        isConfigured: true,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
    });
    closers.push(srv.close);

    const cases = [
      {},
      { messages: [] },
      { messages: [{ role: 'system', content: 'hi' }] },
      { messages: [{ role: 'user', content: '   ' }] },
      { messages: [{ role: 'assistant', content: 'only assistant' }] },
    ];

    for (const payload of cases) {
      const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    }

    const malformedRes = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    assert.equal(malformedRes.status, 400);
    const malformedBody = await malformedRes.json();
    assert.equal(malformedBody.error.code, 'INVALID_JSON');
  });

  it('streams multi-turn conversation chunks via SSE using mocked Gemini client', async () => {
    let capturedParams = null;

    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: 'AIzaSyMockedKey123456',
        isConfigured: true,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
      aiClientFactory: () => ({
        models: {
          async generateContentStream(params) {
            capturedParams = params;
            return (async function* () {
              yield { text: 'Streaming ' };
              yield { text: 'works with ' };
              yield { text: 'context!' };
            })();
          },
        },
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Follow-up question' },
        ],
      }),
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
    const rawText = await res.text();
    const events = parseSseFrames(rawText);

    assert.equal(events[0].event, 'meta');
    assert.equal(events[0].data.model, 'gemini-4-hydrogen');

    const deltas = events.filter((e) => e.event === 'delta').map((e) => e.data.text);
    assert.deepEqual(deltas, ['Streaming ', 'works with ', 'context!']);
    assert.equal(events[events.length - 1].event, 'done');

    assert.equal(capturedParams.model, 'gemini-4-hydrogen');
    assert.deepEqual(capturedParams.contents, [
      { role: 'user', parts: [{ text: 'First question' }] },
      { role: 'model', parts: [{ text: 'First answer' }] },
      { role: 'user', parts: [{ text: 'Follow-up question' }] },
    ]);
    assert.ok(capturedParams.config.abortSignal instanceof AbortSignal);
    assert.ok(typeof capturedParams.config.systemInstruction === 'string');
  });

  it('classifies invalid API key, quota limit, model not found, and network errors', async () => {
    const scenarios = [
      {
        err: Object.assign(new Error('API_KEY_INVALID for AIzaSySecretValue999999999'), {
          status: 400,
        }),
        expectedStatus: 401,
        expectedCode: 'INVALID_API_KEY',
      },
      {
        err: Object.assign(new Error('RESOURCE_EXHAUSTED: quota exceeded'), { status: 429 }),
        expectedStatus: 429,
        expectedCode: 'QUOTA_EXCEEDED',
      },
      {
        err: Object.assign(new Error('models/bad-model is not found'), { status: 404 }),
        expectedStatus: 404,
        expectedCode: 'MODEL_NOT_FOUND',
      },
      {
        err: Object.assign(new Error('fetch failed'), { code: 'ENOTFOUND' }),
        expectedStatus: 502,
        expectedCode: 'NETWORK_ERROR',
      },
    ];

    for (const scenario of scenarios) {
      const srv = await startTestServer({
        getRuntimeConfig: () => ({
          apiKey: 'AIzaSySecretValue999999999',
          isConfigured: true,
          model: 'gemini-4-hydrogen',
          defaultModel: 'gemini-4-hydrogen',
          port: 3001,
          clientOrigin: 'http://localhost:5173',
        }),
        aiClientFactory: () => ({
          models: {
            async generateContentStream() {
              throw scenario.err;
            },
          },
        }),
      });
      closers.push(srv.close);

      const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Trigger error' }],
        }),
      });
      assert.equal(res.status, scenario.expectedStatus);
      const rawText = await res.text();
      assert.equal(rawText.includes('AIzaSySecretValue999999999'), false);
      const body = JSON.parse(rawText);
      assert.equal(body.error.code, scenario.expectedCode);
    }
  });

  it('emits an SSE error event if failure happens mid-stream', async () => {
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: 'test-key',
        isConfigured: true,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
      aiClientFactory: () => ({
        models: {
          async generateContentStream() {
            return (async function* () {
              yield { text: 'Partial chunk ' };
              const err = new Error('RESOURCE_EXHAUSTED');
              err.status = 429;
              throw err;
            })();
          },
        },
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    assert.equal(res.status, 200);
    const events = parseSseFrames(await res.text());
    assert.ok(events.some((e) => e.event === 'delta' && e.data.text === 'Partial chunk '));
    const errEvent = events.find((e) => e.event === 'error');
    assert.ok(errEvent);
    assert.equal(errEvent.data.code, 'QUOTA_EXCEEDED');
  });

  it('propagates client abort to Gemini abortSignal when generation is stopped', async () => {
    let observedSignal = null;
    let firstChunkSentResolve;
    const firstChunkSent = new Promise((resolve) => {
      firstChunkSentResolve = resolve;
    });

    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: 'test-key',
        isConfigured: true,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
      aiClientFactory: () => ({
        models: {
          async generateContentStream({ config }) {
            observedSignal = config.abortSignal;
            return (async function* () {
              yield { text: 'First token ' };
              firstChunkSentResolve();
              await new Promise((resolve) => {
                if (observedSignal.aborted) return resolve();
                observedSignal.addEventListener('abort', resolve, { once: true });
              });
            })();
          },
        },
      }),
    });
    closers.push(srv.close);

    const clientController = new AbortController();
    const res = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Long response' }],
      }),
      signal: clientController.signal,
    });

    const reader = res.body.getReader();
    await reader.read();
    await firstChunkSent;
    clientController.abort();

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(observedSignal.aborted, true);
  });

  it('enforces rate limiting on chat stream requests', async () => {
    const srv = await startTestServer({
      rateLimit: { chatLimit: 2, chatWindowMs: 60000 },
      getRuntimeConfig: () => ({
        apiKey: 'test-key',
        isConfigured: true,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
      aiClientFactory: () => ({
        models: {
          async generateContentStream() {
            return (async function* () {
              yield { text: 'ok' };
            })();
          },
        },
      }),
    });
    closers.push(srv.close);

    for (let i = 0; i < 2; i += 1) {
      const okRes = await fetch(`${srv.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `msg ${i}` }] }),
      });
      assert.equal(okRes.status, 200);
      await okRes.text();
    }

    const limitedRes = await fetch(`${srv.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'msg 3' }] }),
    });
    assert.equal(limitedRes.status, 429);
    const body = await limitedRes.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
  });

  it('serves built frontend index.html with security headers in production mode', async () => {
    const srv = await startTestServer({
      getRuntimeConfig: () => ({
        apiKey: '',
        isConfigured: false,
        model: 'gemini-4-hydrogen',
        defaultModel: 'gemini-4-hydrogen',
        port: 3001,
        clientOrigin: 'http://localhost:5173',
      }),
    });
    closers.push(srv.close);

    const res = await fetch(`${srv.baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/html/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const html = await res.text();
    assert.match(html, /<div id="root"><\/div>/);
  });
});
