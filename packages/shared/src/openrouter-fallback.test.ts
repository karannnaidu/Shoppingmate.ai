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
    process.env.LLM_FALLBACK_RETRY_MS = '1';
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

  it('moves to the next fallback model when the first is out of quota, and keeps Gemini 3 thought signatures', async () => {
    const models: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      if (url.includes('openrouter')) return new Response('{"error":{"code":402}}', { status: 402 });
      const m = JSON.parse(init.body).model as string;
      models.push(m);
      if (m === 'gemini-3.5-flash') return new Response('{"error":{"code":429}}', { status: 429 });
      return ok({
        choices: [{
          message: { content: null, tool_calls: [{ id: 'c1', type: 'function', extra_content: { google: { thought_signature: 'sig' } }, function: { name: 'products_search', arguments: '{}' } }] },
          finish_reason: 'tool_calls',
        }],
      });
    }));
    const r = await chatTools({
      model: 'x',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'products.search', description: 'x', parameters: {} } }],
    });
    // A 429 is retried once on the same model, then the next model is tried.
    expect(models).toEqual(['gemini-3.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);
    expect(r.toolCalls[0]?.extraContent).toEqual({ google: { thought_signature: 'sig' } });
  });

  it('strips Gemini extra_content from history sent to OpenRouter', async () => {
    let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      sent = init.body;
      return ok({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
    }));
    await chatTools({
      model: 'x',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', extra_content: { s: 1 }, function: { name: 'a', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: '{}' },
      ],
      tools: [],
    });
    expect(sent).not.toContain('extra_content');
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

  it('strips a BOM / whitespace from keys (Windows paste) so headers stay valid', async () => {
    process.env.OPENROUTER_API_KEY = '﻿or-key ';
    let auth = '';
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { headers: Record<string, string> }) => {
      auth = init.headers.authorization;
      return ok({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
    }));
    await chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] });
    expect(auth).toBe('Bearer or-key');
  });

  it('classifies fallback-worthy failures', () => {
    expect([402, 429, 500, 503, null].every((s) => shouldFallback(s))).toBe(true);
    expect([400, 401, 404].some((s) => shouldFallback(s))).toBe(false);
    expect(toGeminiMessages([{ role: 'assistant', content: null }])).toEqual([{ role: 'assistant', content: '' }]);
  });
});
