import { describe, expect, it } from 'vitest';
import { FakeWSTransport } from '../../src/dom/transport.js';

describe('FakeWSTransport', () => {
  it('returns scripted ack for a read action', async () => {
    const t = new FakeWSTransport();
    t.scriptOnce({ ok: true, value: '$19.99' });
    const ack = await t.send('s', { type: 'dom.read', selector: '.total' });
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.value).toBe('$19.99');
  });

  it('drains multi-step scripts in order', async () => {
    const t = new FakeWSTransport();
    t.scriptMany([{ ok: true }, { ok: false, reason: 'selector_not_found' }]);
    const a = await t.send('s', { type: 'dom.click', selector: '#a' });
    const b = await t.send('s', { type: 'dom.click', selector: '#b' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });

  it('throws when no script left', async () => {
    const t = new FakeWSTransport();
    await expect(t.send('s', { type: 'dom.read', selector: '.x' })).rejects.toThrow(/script_empty/);
  });
});

describe('WSTransport ui.* actions', () => {
  it('records show_message and show_product_card', async () => {
    const t = new FakeWSTransport();
    t.ackNext({ ok: true });
    await t.send('sess-1', { type: 'ui.show_message', text: 'hello' });
    t.ackNext({ ok: true });
    await t.send('sess-1', {
      type: 'ui.show_product_card',
      product: {
        title: 'Mug',
        imageUrl: 'https://example.com/m.jpg',
        priceCents: 1500,
        currency: 'USD',
        productUrl: 'https://example.com/p/mug',
      },
    });
    const sent = t.sent('sess-1');
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ type: 'ui.show_message', text: 'hello' });
    expect(sent[1]).toMatchObject({
      type: 'ui.show_product_card',
      product: { title: 'Mug' },
    });
  });

  it('ackAll auto-acks every send', async () => {
    const t = new FakeWSTransport();
    t.ackAll({ ok: true });
    const r1 = await t.send('s', { type: 'ui.show_message', text: 'a' });
    const r2 = await t.send('s', { type: 'ui.show_message', text: 'b' });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(t.sent('s')).toHaveLength(2);
  });
});
