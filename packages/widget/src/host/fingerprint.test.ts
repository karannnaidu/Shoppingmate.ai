import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeHostAction } from './actions.js';
import {
  type SiteTemplate,
  coverageOf,
  keyFor,
  keysFromSnapshot,
  matchTemplate,
  skeletonOf,
} from './fingerprint.js';
import { buildSnapshot } from './snapshot.js';
import { setNavContext } from './templates.js';

const pdp = (title: string, price: string) => `
  <header><nav><a href="/">Home</a><a href="/shop">Shop</a><a href="/blog">Blog</a></nav></header>
  <main>
    <h1>${title}</h1><span>${price}</span>
    <button>Add to cart</button><button>Buy now</button>
    <label>Quantity <input type="number" value="1"></label>
    <button>Pack of 2</button>
  </main>
  <footer><a href="/privacy">Privacy policy</a><a href="/terms">Terms</a></footer>`;

afterEach(() => {
  document.body.innerHTML = '';
  setNavContext(null);
  vi.restoreAllMocks();
});

describe('keys + skeleton', () => {
  it('normalizes away prices/digits and drops free text', () => {
    expect(keyFor('button', 'Pack of 2 — 25% Off')).toBe('button|pack of off');
    expect(keyFor('text', '₹649')).toBeNull();
    expect(keyFor('button', '1')).toBeNull();
  });

  it('skeleton = keys shared by every sample (product-specific text drops out)', () => {
    document.body.innerHTML = pdp('Sleep Mantra', '₹649');
    const a = keysFromSnapshot(buildSnapshot().text);
    document.body.innerHTML = pdp('Peace Mantra', '₹899');
    const b = keysFromSnapshot(buildSnapshot().text);
    const sk = skeletonOf([a, b]);
    expect(sk).toContain('button|add to cart');
    expect(sk).toContain('link|shop');
    expect(sk).not.toContain('heading|sleep mantra');
    expect(sk).not.toContain('heading|peace mantra');
  });
});

describe('matchTemplate()', () => {
  const tpl: SiteTemplate = {
    id: 't-pdp',
    pageType: 'pdp',
    urlPattern: '^/shop/[^/]+$',
    skeleton: ['button|add to cart', 'button|buy now', 'link|shop', 'link|home', 'link|blog'],
    recipes: [{ action: 'add_to_cart', role: 'button', name: 'Add to cart' }],
  };

  it('matches when the skeleton is covered', () => {
    const keys = [
      'button|add to cart',
      'button|buy now',
      'link|shop',
      'link|home',
      'link|blog',
      'heading|x',
    ];
    const m = matchTemplate(keys, '/shop/x', [tpl]);
    expect(m.template?.id).toBe('t-pdp');
    expect(m.drift).toBeNull();
  });

  it('flags drift when the URL says PDP but the structure changed', () => {
    const keys = ['button|add to bag', 'link|shop', 'link|home'];
    const m = matchTemplate(keys, '/shop/x', [tpl]);
    expect(m.template).toBeNull();
    expect(m.drift?.template.id).toBe('t-pdp');
    expect(m.drift?.coverage).toBeLessThan(0.7);
  });

  it('ignores tiny skeletons (cannot judge)', () => {
    const tiny = { ...tpl, skeleton: ['link|home'] };
    expect(matchTemplate(['link|home'], '/shop/x', [tiny]).template).toBeNull();
    expect(coverageOf([], new Set())).toBe(0);
  });
});

describe('page_snapshot with templates', () => {
  it('collapses static site links, adds the template line, and reports drift once', async () => {
    document.body.innerHTML = pdp('Sleep Mantra', '₹649');
    const keys = keysFromSnapshot(buildSnapshot().text);
    const template: SiteTemplate = {
      id: 't1',
      pageType: 'pdp',
      urlPattern: '^/$',
      skeleton: keys.filter((k) => !k.startsWith('heading')),
      recipes: [{ action: 'add_to_cart', role: 'button', name: 'Add to cart' }],
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/v1/site-templates/M1')) {
        return new Response(JSON.stringify({ templates: [template] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    setNavContext({ apiBase: 'https://api.test', merchantId: 'M1', sessionId: 's1' });

    const r = await executeHostAction({ type: 'page_snapshot' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const text = r.values?.snapshot ?? '';
    expect(text).toContain('[template] pdp page (known layout');
    expect(text).toContain('add to cart = button "Add to cart"');
    expect(text).toMatch(/\[site links\] .*Shop/);
    expect(text).not.toMatch(/\[e\d+\] link "Shop"/);
    expect(text).toMatch(/\[e\d+\] button "Add to cart"/); // actionable controls keep refs
    expect(r.values?.template).toBe('pdp');

    // Mutate the page so the structure no longer matches → drift reported once.
    document.body.innerHTML = '<main><h1>New design</h1><button>Add to bag</button></main>';
    await executeHostAction({ type: 'page_snapshot' });
    await executeHostAction({ type: 'page_snapshot' });
    const signals = fetchSpy.mock.calls.filter(([u]) => String(u).endsWith('/signal'));
    expect(signals).toHaveLength(1);
    const body = JSON.parse(String((signals[0]?.[1] as RequestInit).body));
    expect(body).toMatchObject({ kind: 'drift', templateId: 't1', sessionId: 's1' });
  });
});
