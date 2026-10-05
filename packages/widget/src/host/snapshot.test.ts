import { afterEach, describe, expect, it } from 'vitest';
import { executeHostAction } from './actions.js';
import { buildSnapshot, elementForRef } from './snapshot.js';

const PDP = `
  <header><nav><a href="/">Home</a><a href="/shop">Shop</a></nav></header>
  <main>
    <h1>Sleep Mantra</h1>
    <span class="price">₹649</span>
    <fieldset>
      <label><input type="radio" name="size" value="50" checked> 50 ml</label>
      <label><input type="radio" name="size" value="100"> 100 ml</label>
    </fieldset>
    <button id="atc">Add to cart</button>
    <button disabled>Sold out</button>
    <input type="email" placeholder="Email" value="a@b.com">
    <input type="password" name="pw" value="secret">
    <input type="hidden" name="token" value="x">
    <div aria-hidden="true"><button>Hidden thing</button></div>
  </main>
  <footer><a href="/privacy">Privacy</a></footer>
`;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildSnapshot()', () => {
  it('lists interactive + context elements with refs and states', () => {
    document.title = 'Sleep Mantra – Calmosis';
    document.body.innerHTML = PDP;
    const snap = buildSnapshot();
    expect(snap.text).toContain('[page] Sleep Mantra – Calmosis');
    expect(snap.text).toMatch(/\[e\d+\] heading "Sleep Mantra"/);
    expect(snap.text).toMatch(/\[e\d+\] text "₹649"/);
    expect(snap.text).toMatch(/\[e\d+\] radio "50 ml" \(checked\)/);
    expect(snap.text).toMatch(/\[e\d+\] button "Add to cart"/);
    expect(snap.text).toMatch(/\[e\d+\] button "Sold out" \(disabled\)/);
    expect(snap.text).toMatch(/textbox "Email" \(value="a@b.com"\)/);
    expect(snap.refs).toBeGreaterThan(5);
  });

  it('never leaks password values, hidden inputs, or aria-hidden content', () => {
    document.body.innerHTML = PDP;
    const snap = buildSnapshot();
    expect(snap.text).not.toContain('secret');
    expect(snap.text).toMatch(/textbox "pw" \(filled\)/);
    expect(snap.text).not.toContain('token');
    expect(snap.text).not.toContain('Hidden thing');
  });

  it('puts an open dialog first-class and excludes our own widget nodes', () => {
    document.body.innerHTML = `
      <main><button>Buy</button></main>
      <div role="dialog" aria-label="Get 10% off"><button>Close</button></div>
      <shoppingmate-widget><button>Widget button</button></shoppingmate-widget>
      <div data-shoppingmate-cursor><button>Cursor</button></div>`;
    const snap = buildSnapshot();
    expect(snap.text).toContain('dialog "Get 10% off" (open)');
    expect(snap.text).toContain('button "Close"');
    expect(snap.text).not.toContain('Widget button');
    expect(snap.text).not.toContain('Cursor');
  });

  it('respects the size budget, keeping main content over footer links', () => {
    const links = Array.from(
      { length: 300 },
      (_, i) => `<a href="/f${i}">Footer link ${i}</a>`,
    ).join('');
    document.body.innerHTML = `<main><button>Add to cart</button></main><footer>${links}</footer>`;
    const snap = buildSnapshot({ maxChars: 800 });
    expect(snap.chars).toBeLessThanOrEqual(900);
    expect(snap.text).toContain('button "Add to cart"');
    expect(snap.truncated).toBeGreaterThan(0);
    expect(snap.text).toMatch(/more elements not shown/);
  });

  it('resolves refs back to live elements', () => {
    document.body.innerHTML = PDP;
    const snap = buildSnapshot();
    const ref = /\[(e\d+)\] button "Add to cart"/.exec(snap.text)?.[1];
    expect(ref).toBeDefined();
    expect(elementForRef(ref as string)?.id).toBe('atc');
    expect(elementForRef(`[${ref}]`)?.id).toBe('atc');
    expect(elementForRef('e999')).toBeNull();
  });
});

describe('page_snapshot + click by ref (verify-after-action)', () => {
  it('page_snapshot returns the snapshot text in values', async () => {
    document.body.innerHTML = PDP;
    const r = await executeHostAction({ type: 'page_snapshot' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values?.snapshot).toContain('button "Add to cart"');
      expect(Number(r.values?.refs)).toBeGreaterThan(0);
    }
  });

  it('reports verified:true when the click changes the page', async () => {
    document.body.innerHTML = `<main><button id="b">Add</button><span class="cart-count">0</span></main>`;
    document.getElementById('b')?.addEventListener('click', () => {
      const c = document.querySelector('.cart-count');
      if (c) c.textContent = '1';
    });
    const snap = buildSnapshot();
    const ref = /\[(e\d+)\] button "Add"/.exec(snap.text)?.[1] as string;
    const r = await executeHostAction({ type: 'click', intent: 'Add', ref });
    expect(r).toMatchObject({ ok: true, verified: true });
    if (r.ok) expect(r.observed).toContain('cart count 0 → 1');
  });

  it('reports verified:false for a dead click (nothing changes)', async () => {
    document.body.innerHTML = `<main><button id="b">Does nothing</button></main>`;
    const snap = buildSnapshot();
    const ref = /\[(e\d+)\] button/.exec(snap.text)?.[1] as string;
    const r = await executeHostAction({ type: 'click', intent: 'Does nothing', ref });
    expect(r).toMatchObject({ ok: true, verified: false });
  }, 10_000);

  it('a stale ref with no matching intent fails honestly', async () => {
    document.body.innerHTML = `<main><button>Gone</button></main>`;
    const r = await executeHostAction({ type: 'click', intent: '', ref: 'e42' });
    expect(r).toEqual({ ok: false, reason: 'stale_target' });
  });

  it('form_fill honours a ref for the exact control', async () => {
    document.body.innerHTML = `<main><input id="a" placeholder="Email"><input id="b" placeholder="Email"></main>`;
    const snap = buildSnapshot();
    const refs = [...snap.text.matchAll(/\[(e\d+)\] textbox "Email"/g)].map((m) => m[1]);
    const r = await executeHostAction({
      type: 'form_fill',
      fields: [{ field: 'Email', value: 'x@y.com', ref: refs[1] }],
    });
    expect(r.ok).toBe(true);
    expect((document.getElementById('b') as HTMLInputElement).value).toBe('x@y.com');
    expect((document.getElementById('a') as HTMLInputElement).value).toBe('');
  });
});
