import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chat } from './openrouter.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('chat()', () => {
  it('posts model+messages, returns text + token counts', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        const body = (await request.json()) as { model: string; messages: unknown[] };
        expect(body.model).toBe('anthropic/claude-haiku-4.5');
        expect(body.messages).toHaveLength(1);
        return HttpResponse.json({
          choices: [{ message: { content: 'pong' } }],
          usage: { prompt_tokens: 4, completion_tokens: 1 },
        });
      }),
    );
    const r = await chat({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'ping' }],
    });
    expect(r).toEqual({ text: 'pong', inputTokens: 4, outputTokens: 1 });
  });
});
