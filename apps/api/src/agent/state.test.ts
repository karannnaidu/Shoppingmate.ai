import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AnthropicMessage } from './types.js';
import type { SessionState } from './types.js';
import {
  SESSION_TTL_SECONDS,
  TOKEN_BUDGET,
  createSession,
  loadSession,
  saveSession,
  truncateHistory,
} from './state.js';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

beforeAll(async () => {
  await redis.ping();
});
afterAll(async () => {
  await redis.quit();
});
beforeEach(async () => {
  const keys = await redis.keys('session:test-*');
  if (keys.length > 0) await redis.del(...keys);
});

const baseSession: SessionState = {
  sessionId: 'test-1',
  merchantId: 'm',
  cartToken: null,
  history: [],
  turnCount: 0,
  voiceMs: 0,
  totalMs: 0,
  startedAt: 0,
  lastTurnAt: 0,
  mode: 'text',
};

describe('session repo', () => {
  it('createSession returns fresh state with the given sessionId/merchantId/mode', () => {
    const s = createSession({ sessionId: 'test-2', merchantId: 'm', mode: 'voice', nowMs: 100 });
    expect(s).toMatchObject({
      sessionId: 'test-2',
      merchantId: 'm',
      mode: 'voice',
      startedAt: 100,
      lastTurnAt: 100,
      turnCount: 0,
      history: [],
    });
  });

  it('saves and loads a session', async () => {
    await saveSession(redis, baseSession);
    const loaded = await loadSession(redis, 'test-1');
    expect(loaded).toEqual(baseSession);
  });

  it('returns null for missing session', async () => {
    expect(await loadSession(redis, 'test-missing')).toBeNull();
  });

  it('sets a 24h TTL on save', async () => {
    await saveSession(redis, baseSession);
    const ttl = await redis.ttl('session:test-1');
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);
  });

  it('extends TTL on every save', async () => {
    await saveSession(redis, baseSession);
    await new Promise((r) => setTimeout(r, 1100));
    await saveSession(redis, baseSession);
    const ttl = await redis.ttl('session:test-1');
    expect(ttl).toBeGreaterThan(SESSION_TTL_SECONDS - 2);
  });
});

describe('truncateHistory()', () => {
  function msg(role: 'user' | 'assistant', text: string): AnthropicMessage {
    return { role, content: text } as AnthropicMessage;
  }

  it('passes through small histories', () => {
    const h: AnthropicMessage[] = [msg('user', 'a'), msg('assistant', 'b')];
    expect(truncateHistory(h)).toEqual(h);
  });

  it('drops oldest messages until under budget', () => {
    const huge = 'x'.repeat(TOKEN_BUDGET * 4); // ~TOKEN_BUDGET tokens (4 chars/token heuristic)
    const h: AnthropicMessage[] = [msg('user', huge), msg('user', 'small')];
    const out = truncateHistory(h);
    expect(out).toEqual([msg('user', 'small')]);
  });

  it('preserves order from oldest to newest after truncation', () => {
    const h: AnthropicMessage[] = [
      msg('user', 'a'),
      msg('assistant', 'b'),
      msg('user', 'c'),
    ];
    const out = truncateHistory(h);
    expect(out.map((m) => (m as { content: string }).content)).toEqual(['a', 'b', 'c']);
  });
});
