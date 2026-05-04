import { describe, expect, it } from 'vitest';
import { decodeAgentEvent, encodeWidgetMessage } from '../src/transport/codec.js';

describe('codec', () => {
  it('encodes user_text as JSON', () => {
    const out = encodeWidgetMessage({
      type: 'user_text',
      sessionId: 'ws_abc',
      text: 'hi',
      mode: 'voice',
    });
    expect(JSON.parse(out)).toEqual({
      type: 'user_text',
      sessionId: 'ws_abc',
      text: 'hi',
      mode: 'voice',
    });
  });

  it('encodes card_tap with variantId null when omitted', () => {
    const out = encodeWidgetMessage({
      type: 'card_tap',
      sessionId: 'ws_abc',
      action: 'cartAdd',
      sku: 'SKU-1',
      variantId: null,
      qty: 1,
    });
    expect(JSON.parse(out).variantId).toBeNull();
  });

  it('decodes a say event', () => {
    const ev = decodeAgentEvent(JSON.stringify({ type: 'say', text: 'hello' }));
    expect(ev).toEqual({ type: 'say', text: 'hello' });
  });

  it('decodes a cards event', () => {
    const ev = decodeAgentEvent(
      JSON.stringify({
        type: 'cards',
        items: [
          {
            image: 'https://i/p.jpg',
            title: 'Cream',
            priceFormatted: 'USD 14.99',
            variantId: null,
            sku: 'SKU-1',
            productUrl: 'https://shop/p',
          },
        ],
      }),
    );
    expect(ev?.type).toBe('cards');
    if (ev?.type === 'cards') expect(ev.items).toHaveLength(1);
  });

  it('returns null on malformed JSON', () => {
    expect(decodeAgentEvent('not-json')).toBeNull();
  });

  it('returns null on unknown event type', () => {
    expect(decodeAgentEvent(JSON.stringify({ type: 'mystery' }))).toBeNull();
  });
});
