import { describe, expect, it } from 'vitest';
import { decodeAgentEvent } from './codec.js';

describe('decodeAgentEvent — host_action_request validation', () => {
  it('decodes a cart_add host action (regression: was dropped → 5s timeout)', () => {
    const raw = JSON.stringify({
      type: 'host_action_request',
      callId: 'ha_1',
      action: { type: 'cart_add', sku: 'sleep-mantra', qty: 1 },
    });
    const ev = decodeAgentEvent(raw);
    expect(ev).not.toBeNull();
    expect(ev).toMatchObject({
      type: 'host_action_request',
      callId: 'ha_1',
      action: { type: 'cart_add', sku: 'sleep-mantra', qty: 1 },
    });
  });

  it('decodes cart_set_qty and apply_coupon host actions', () => {
    expect(
      decodeAgentEvent(JSON.stringify({ type: 'host_action_request', callId: 'q', action: { type: 'cart_set_qty', sku: 'sleep-mantra', qty: 1 } })),
    ).not.toBeNull();
    expect(
      decodeAgentEvent(JSON.stringify({ type: 'host_action_request', callId: 'c', action: { type: 'apply_coupon', code: 'CALM10' } })),
    ).not.toBeNull();
  });

  it('decodes an open_cart host action', () => {
    const raw = JSON.stringify({
      type: 'host_action_request',
      callId: 'ha_2',
      action: { type: 'open_cart' },
    });
    expect(decodeAgentEvent(raw)).not.toBeNull();
  });

  it('still decodes navigate, and rejects unknown action types', () => {
    expect(
      decodeAgentEvent(JSON.stringify({ type: 'host_action_request', callId: 'a', action: { type: 'navigate', path: '/shop' } })),
    ).not.toBeNull();
    expect(
      decodeAgentEvent(JSON.stringify({ type: 'host_action_request', callId: 'b', action: { type: 'bogus' } })),
    ).toBeNull();
  });
});
