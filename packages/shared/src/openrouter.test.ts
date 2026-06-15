import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chat, chatTools } from './openrouter.js';

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

describe('chatTools()', () => {
  it('passes tools array and returns tool_calls when model wants to invoke a tool', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
        const body = (await request.json()) as {
          tools: unknown[];
          messages: unknown[];
          max_tokens?: number;
        };
        expect(body.tools).toHaveLength(1);
        // Must bound max_tokens — otherwise OpenRouter reserves credit for the
        // model's full default output (64K), 402-ing when the balance is low.
        expect(typeof body.max_tokens).toBe('number');
        expect(body.max_tokens).toBeGreaterThan(0);
        expect(body.max_tokens).toBeLessThanOrEqual(4096);
        return HttpResponse.json({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'products.search', arguments: '{"query":"dress"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });
      }),
    );
    const r = await chatTools({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [{ role: 'user', content: 'find me a dress' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'products.search',
            description: 'search the catalog',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        },
      ],
    });
    expect(r.stopReason).toBe('tool_calls');
    expect(r.toolCalls).toEqual([
      { id: 'call_1', name: 'products.search', argumentsJson: '{"query":"dress"}' },
    ]);
    expect(r.text).toBe('');
  });

  it('returns text + stopReason=stop when model finishes without tools', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    server.use(
      http.post('https://openrouter.ai/api/v1/chat/completions', () =>
        HttpResponse.json({
          choices: [{ message: { role: 'assistant', content: 'hi there' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 3 },
        }),
      ),
    );
    const r = await chatTools({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
    });
    expect(r.stopReason).toBe('stop');
    expect(r.text).toBe('hi there');
    expect(r.toolCalls).toEqual([]);
  });
});
