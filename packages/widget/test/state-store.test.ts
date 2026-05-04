import { describe, expect, it } from 'vitest';
import { createStore } from '../src/state/store.js';

describe('store reducer', () => {
  it('appends user_text on local input', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'user_input', text: 'hi', mode: 'text' });
    expect(s.get().transcript).toEqual([
      expect.objectContaining({ role: 'user', kind: 'text', text: 'hi' }),
    ]);
  });

  it('appends agent text bubble per say event', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'hello' } });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'how can I help?' } });
    expect(s.get().transcript).toHaveLength(2);
    expect(s.get().transcript.every((i) => i.role === 'agent' && i.kind === 'text')).toBe(true);
  });

  it('appends inline cards row', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({
      type: 'agent_event',
      event: {
        type: 'cards',
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10.00',
            variantId: null,
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
    });
    const last = s.get().transcript[0];
    if (!last) throw new Error('expected card row');
    expect(last.kind).toBe('cards');
  });

  it('checkout_redirect sets checkoutUrl, no transcript change', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({
      type: 'agent_event',
      event: { type: 'checkout_redirect', url: 'https://shop/checkout' },
    });
    expect(s.get().checkoutUrl).toBe('https://shop/checkout');
    expect(s.get().transcript).toHaveLength(0);
  });

  it('session_closed disables input', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'session_closed', reason: 'cap' } });
    expect(s.get().closed).toBe(true);
    expect(s.get().closedReason).toBe('cap');
  });

  it('subscribe is invoked on every dispatch', () => {
    const s = createStore({ sessionId: 'ws_a' });
    let count = 0;
    s.subscribe(() => {
      count += 1;
    });
    s.dispatch({ type: 'user_input', text: 'a', mode: 'text' });
    s.dispatch({ type: 'agent_event', event: { type: 'thinking' } });
    expect(count).toBe(2);
  });

  it('reset replaces transcript (used on session_resume replay)', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'user_input', text: 'hi', mode: 'text' });
    s.dispatch({ type: 'reset' });
    expect(s.get().transcript).toHaveLength(0);
  });
});
