import { describe, expect, it } from 'vitest';
import { replaySession } from './replay.js';
import type { SessionState } from './types.js';

const session: SessionState = {
  sessionId: 's-1',
  merchantId: 'm',
  cartToken: 'ct1',
  history: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello there' },
    { role: 'user', content: 'show me a dress' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c1', type: 'function', function: { name: 'products.search', arguments: '{}' } }],
    },
    {
      role: 'tool',
      tool_call_id: 'c1',
      content: JSON.stringify({ ok: true, value: [{ sku: 'A', title: 'Silk', priceCents: 100_000, currency: 'INR', productUrl: '/a' }] }),
    },
    { role: 'assistant', content: 'see the cards' },
  ],
  turnCount: 2,
  voiceMs: 0,
  totalMs: 0,
  startedAt: 0,
  lastTurnAt: 0,
  mode: 'text',
};

describe('replaySession()', () => {
  it('emits prior assistant says and cards extracted from tool results', () => {
    const events = Array.from(replaySession(session));
    const says = events.filter((e) => e.type === 'say').map((e) => (e as { text: string }).text);
    expect(says).toContain('hello there');
    expect(says).toContain('see the cards');
    expect(events.some((e) => e.type === 'cards')).toBe(true);
  });
});
