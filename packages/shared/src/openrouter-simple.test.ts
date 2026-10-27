import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIMPLE_MODEL_DEFAULT, simpleChat, simpleModel } from './openrouter.js';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('simpleChat (cheap open-model tier)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.GEMINI_API_KEY = 'g-key';
    process.env.LLM_FALLBACK_RETRY_MS = '1';
    delete process.env.OPENROUTER_SIMPLE_MODEL;
    process.env.OPENROUTER_MODEL = 'anthropic/claude-haiku-4.5';
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('asks the open model first with Claude as the OpenRouter backup', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return ok({ choices: [{ message: { content: '{"intent":"browsing"}' } }] });
    }));
    const r = await simpleChat({ messages: [{ role: 'user', content: 'x' }], responseFormat: 'json', maxTokens: 256 });
    expect(r.text).toContain('browsing');
    expect(body.model).toBe(SIMPLE_MODEL_DEFAULT);
    expect(body.models).toEqual([SIMPLE_MODEL_DEFAULT, 'anthropic/claude-haiku-4.5']);
    expect(body.max_tokens).toBe(256);
  });

  it('env override reverts it (no duplicate backup when equal)', async () => {
    process.env.OPENROUTER_SIMPLE_MODEL = 'anthropic/claude-haiku-4.5';
    expect(simpleModel()).toBe('anthropic/claude-haiku-4.5');
    let body: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return ok({ choices: [{ message: { content: 'ok' } }] });
    }));
    await simpleChat({ messages: [{ role: 'user', content: 'x' }] });
    expect(body.models).toBeUndefined();
  });

  it('never sends the OpenRouter-only `models` list to the Gemini fallback', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return url.includes('openrouter') ? new Response('{}', { status: 503 }) : ok({ choices: [{ message: { content: 'ok' } }] });
    }));
    await simpleChat({ messages: [{ role: 'user', content: 'x' }] });
    const gemini = bodies.at(-1) as Record<string, unknown>;
    expect(gemini.models).toBeUndefined();
    expect(String(gemini.model)).toMatch(/^gemini/);
  });
});
