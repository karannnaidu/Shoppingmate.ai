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

  it('clears the thinking spinner when the connection drops mid-turn', () => {
    // A mid-turn WS drop loses the turn's say/end_of_turn, so nothing else would
    // ever flip thinking back off — the spinner must not hang.
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'thinking' } });
    expect(s.get().thinking).toBe(true);
    s.dispatch({ type: 'set_connection', status: 'reconnecting' });
    expect(s.get().thinking).toBe(false);
  });

  it('clears thinking when the connection is fully lost', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'thinking' } });
    s.dispatch({ type: 'set_connection', status: 'disconnected' });
    expect(s.get().thinking).toBe(false);
  });

  it('keeps thinking while the connection stays healthy', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'thinking' } });
    s.dispatch({ type: 'set_connection', status: 'connected' });
    expect(s.get().thinking).toBe(true);
  });

  it('cards landing mid-reply do not duplicate the streaming caption', () => {
    // Live calmosis.com 2026-10-27: partial → cards → final "say" left two
    // copies of Olivia's reply (the final appended instead of finalizing).
    const s = createStore({ sessionId: 'ws_a' });
    const card = { image: null, title: 'A', priceFormatted: 'INR 1', variantId: null, sku: 'A-1', productUrl: 'https://x' };
    s.dispatch({ type: 'agent_event', event: { type: 'user_text', text: 'something for sleep?' } });
    s.dispatch({ type: 'agent_event', event: { type: 'say_partial', text: 'For better sleep' } });
    s.dispatch({ type: 'agent_event', event: { type: 'cards', items: [card] } });
    s.dispatch({ type: 'agent_event', event: { type: 'say_partial', text: 'For better sleep, try Sleep' } });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'For better sleep, try Sleep Mantra.' } });
    const agentTexts = s.get().transcript.filter((i) => i.role === 'agent' && i.kind === 'text');
    expect(agentTexts).toHaveLength(1);
    expect(agentTexts[0]).toMatchObject({ text: 'For better sleep, try Sleep Mantra.', partial: false });
    // The next turn still gets its own bubble.
    s.dispatch({ type: 'agent_event', event: { type: 'user_text', text: 'price?' } });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'On the card.' } });
    expect(s.get().transcript.filter((i) => i.role === 'agent' && i.kind === 'text')).toHaveLength(2);
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
