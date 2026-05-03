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
    t.scriptMany([
      { ok: true },
      { ok: false, reason: 'selector_not_found' },
    ]);
    const a = await t.send('s', { type: 'dom.click', selector: '#a' });
    const b = await t.send('s', { type: 'dom.click', selector: '#b' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });

  it('throws when no script left', async () => {
    const t = new FakeWSTransport();
    await expect(t.send('s', { type: 'dom.read', selector: '.x' })).rejects.toThrow(
      /script_empty/,
    );
  });
});
