import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatTools, chat, shouldFallback, toGeminiMessages } from './openrouter.js';

// Regression for the 2026-10-07 outage: OpenRouter ran out of credit (402) and
// every brand's bot replied "trouble reaching my brain". Calls now fall back to
// Gemini's OpenAI-compatible endpoint when GEMINI_API_KEY is set.

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const toolReply = {
  choices: [
    {
      message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'products_search', arguments: '{"query":"wool"}' } }] },
      finish_reason: 'tool_calls',
    },
  ],
};

describe('LLM fallback', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.GEMINI_API_KEY = 'g-key';
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('retries on Gemini when OpenRouter is out of credit, keeping canonical tool names', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      return url.includes('openrouter') ? new Response('{"error":{"code":402}}', { status: 402 }) : ok(toolReply);
    }));
    const r = await chatTools({
      model: 'anthropic/claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'wool shoes' }],
      tools: [{ type: 'function', function: { name: 'products.search', description: 'x', parameters: {} } }],
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('generativelanguage.googleapis.com');
    expect(r.toolCalls[0]).toMatchObject({ name: 'products.search' });
  });

  it('does not fall back on a 400 (a real request bug) and surfaces the error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 400 })));
    await expect(chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/openrouter http 400/);
  });

  it('keeps the 402 in the error when no fallback key is configured (ops alerting still fires)', async () => {
    delete process.env.GEMINI_API_KEY;
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":402}}', { status: 402 })));
    await expect(chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/openrouter http 402/);
  });

  it('classifies fallback-worthy failures', () => {
    expect([402, 429, 500, 503, null].every((s) => shouldFallback(s))).toBe(true);
    expect([400, 401, 404].some((s) => shouldFallback(s))).toBe(false);
    expect(toGeminiMessages([{ role: 'assistant', content: null }])).toEqual([{ role: 'assistant', content: '' }]);
  });
});
