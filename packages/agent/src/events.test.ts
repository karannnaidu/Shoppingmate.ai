import { describe, expect, it } from 'vitest';
import { decodeWidgetMessage, encodeAgentEvent } from './events.js';

describe('encodeAgentEvent()', () => {
  it('encodes say', () => {
    expect(encodeAgentEvent({ type: 'say', text: 'hello' })).toBe('{"type":"say","text":"hello"}');
  });
  it('encodes cards', () => {
    const out = encodeAgentEvent({
      type: 'cards',
      items: [
        {
          image: null,
          title: 'A',
          priceFormatted: '\u20B9100',
          variantId: null,
          sku: 'A',
          productUrl: '/a',
        },
      ],
    });
    expect(JSON.parse(out)).toMatchObject({ type: 'cards', items: [{ sku: 'A' }] });
  });
});

describe('decodeWidgetMessage()', () => {
  it('decodes user_text', () => {
    const r = decodeWidgetMessage('{"type":"user_text","sessionId":"s","text":"hi","mode":"text"}');
    expect(r).toEqual({ type: 'user_text', sessionId: 's', text: 'hi', mode: 'text' });
  });
  it('decodes user_text preserving visitorId', () => {
    const r = decodeWidgetMessage(
      '{"type":"user_text","sessionId":"s","text":"hi","mode":"text","visitorId":"v_abc"}',
    );
    expect(r).toEqual({ type: 'user_text', sessionId: 's', text: 'hi', mode: 'text', visitorId: 'v_abc' });
  });
  it('decodes card_tap', () => {
    const r = decodeWidgetMessage(
      '{"type":"card_tap","sessionId":"s","action":"cartAdd","variantId":null,"sku":"A","qty":1}',
    );
    expect(r).toMatchObject({ type: 'card_tap', sku: 'A', qty: 1 });
  });
  it('returns null for malformed JSON', () => {
    expect(decodeWidgetMessage('{not json')).toBeNull();
  });
  it('returns null for missing type', () => {
    expect(decodeWidgetMessage('{}')).toBeNull();
  });
  it('returns null for unknown type', () => {
    expect(decodeWidgetMessage('{"type":"bogus","sessionId":"s"}')).toBeNull();
  });
  it('returns null for missing sessionId on user_text', () => {
    expect(decodeWidgetMessage('{"type":"user_text","text":"hi","mode":"text"}')).toBeNull();
  });
});
