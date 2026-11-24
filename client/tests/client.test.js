import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ChatApiError, streamChatResponse } from '../src/services/chatApi.js';
import {
  deriveTitleFromPrompt,
  groupConversationsByDate,
  loadConversations,
} from '../src/utils/storage.js';

describe('Client storage and SSE stream utilities', () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  });

  it('derives clean truncated conversation titles from prompts', () => {
    assert.equal(deriveTitleFromPrompt('   '), 'New chat');
    assert.equal(deriveTitleFromPrompt('Hello\n  world'), 'Hello world');
    const long = 'Explain how Server-Sent Events handle reconnection and backpressure in Node';
    const title = deriveTitleFromPrompt(long);
    assert.ok(title.length <= 46);
    assert.ok(title.endsWith('…'));
  });

  it('groups conversations into Today, Yesterday, Previous 7 days, and Older', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const grouped = groupConversationsByDate([
      { id: '1', updatedAt: new Date(now).toISOString() },
      { id: '2', updatedAt: new Date(now - day).toISOString() },
      { id: '3', updatedAt: new Date(now - 3 * day).toISOString() },
      { id: '4', updatedAt: new Date(now - 14 * day).toISOString() },
    ]);

    assert.deepEqual(
      grouped.map(([label]) => label),
      ['Today', 'Yesterday', 'Previous 7 days', 'Older'],
    );
  });

  it('recovers interrupted streaming/loading messages from localStorage on reload', () => {
    const store = new Map([
      [
        'chating.conversations.v1',
        JSON.stringify([
          {
            id: 'c1',
            title: 'Interrupted',
            updatedAt: '2026-11-24T10:00:00.000Z',
            messages: [
              { id: 'm1', role: 'user', content: 'Hi', status: 'completed' },
              { id: 'm2', role: 'assistant', content: 'Partial', status: 'streaming' },
              { id: 'm3', role: 'assistant', content: '', status: 'loading' },
            ],
          },
        ]),
      ],
    ]);

    globalThis.localStorage = {
      getItem: (key) => store.get(key) ?? null,
    };

    const loaded = loadConversations();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].messages[1].status, 'stopped');
    assert.equal(loaded[0].messages[2].status, 'error');
  });

  it('parses chunked SSE frames split across reads and forwards meta/deltas/done', async () => {
    const encoder = new TextEncoder();
    const parts = [
      'event: meta\ndata: {"model":"gemini-4-hydrogen"}\n\n',
      'event: delta\ndata: {"text":"Hello "}\n\nevent: del',
      'ta\ndata: {"text":"world!"}\n\nevent: done\ndata: {"model":"gemini-4-hydrogen"}\n\n',
    ];

    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const part of parts) {
              controller.enqueue(encoder.encode(part));
            }
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );

    let modelSeen = '';
    let assembled = '';
    let doneCount = 0;

    await streamChatResponse({
      messages: [{ role: 'user', content: 'Hi' }],
      onMeta: (m) => {
        modelSeen = m.model;
      },
      onDelta: (t) => {
        assembled += t;
      },
      onDone: () => {
        doneCount += 1;
      },
    });

    assert.equal(modelSeen, 'gemini-4-hydrogen');
    assert.equal(assembled, 'Hello world!');
    assert.equal(doneCount, 1);
  });

  it('throws ChatApiError on HTTP error JSON and mid-stream SSE error events', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { code: 'MISSING_API_KEY', message: 'Key missing' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );

    await assert.rejects(
      () => streamChatResponse({ messages: [{ role: 'user', content: 'Hi' }] }),
      (err) => err instanceof ChatApiError && err.code === 'MISSING_API_KEY' && err.status === 503,
    );

    const encoder = new TextEncoder();
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('event: error\ndata: {"code":"QUOTA_EXHAUSTED","message":"Limit hit"}\n\n'),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      );

    await assert.rejects(
      () => streamChatResponse({ messages: [{ role: 'user', content: 'Hi' }] }),
      (err) => err instanceof ChatApiError && err.code === 'QUOTA_EXHAUSTED',
    );
  });
});
