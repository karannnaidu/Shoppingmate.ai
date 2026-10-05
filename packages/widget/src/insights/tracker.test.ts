import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consentAllows,
  consentSignal,
  deviceOf,
  inSample,
  pageTypeFor,
  sourceOf,
  startInsights,
} from './tracker.js';

const ctx = {
  apiBase: 'https://api.test',
  merchantId: 'M1',
  sessionId: 'sess-1',
  visitorId: 'v1',
  config: { enabled: true, sampleRate: 1 },
};

let beacons: string[] = [];
let stop: (() => void) | null = null;

beforeEach(() => {
  beacons = [];
  document.body.innerHTML =
    '<main><form><input name="email" /><button type="button" id="b">Add to cart</button></form></main>';
  (navigator as unknown as { sendBeacon: unknown }).sendBeacon = vi.fn(
    (_url: string, blob: Blob) => {
      void blob.text().then((t) => beacons.push(t));
      return true;
    },
  );
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"templates":[]}'));
});

afterEach(() => {
  stop?.();
  stop = null;
  vi.restoreAllMocks();
  delete (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl;
});

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('helpers', () => {
  it('classifies device, source and page type', () => {
    expect(deviceOf(390)).toBe('mobile');
    expect(deviceOf(900)).toBe('tablet');
    expect(deviceOf(1440)).toBe('desktop');
    expect(sourceOf('?utm_source=Instagram', '', 'shop.com')).toBe('instagram');
    expect(sourceOf('', 'https://www.google.com/search?q=x', 'shop.com')).toBe('google');
    expect(sourceOf('', '', 'shop.com')).toBe('direct');
    const tpl = [{ pageType: 'pdp', urlPattern: '^/shop/[^/]+/?$' }];
    expect(pageTypeFor('/shop/sleep-mantra', tpl)).toBe('pdp');
    expect(pageTypeFor('/checkout', tpl)).toBe('checkout');
    expect(pageTypeFor('/order-success', tpl)).toBe('purchase');
    expect(pageTypeFor('/', tpl)).toBe('home');
  });

  it('consent: explicit signals win; Europe needs a yes; GPC means no', () => {
    expect(consentAllows(null, 'Asia/Kolkata')).toBe(true);
    expect(consentAllows(null, 'Europe/London')).toBe(false);
    expect(consentAllows(true, 'Europe/London')).toBe(true);
    expect(consentAllows(false, 'America/New_York')).toBe(false);
    expect(
      consentSignal({ Shopify: { customerPrivacy: { analyticsProcessingAllowed: () => false } } }),
    ).toBe(false);
    expect(consentSignal({ OnetrustActiveGroups: ',C0001,C0002,' })).toBe(true);
    (navigator as unknown as { globalPrivacyControl: boolean }).globalPrivacyControl = true;
    expect(consentSignal({})).toBe(false);
  });

  it('sampling is sticky per session', () => {
    expect(inSample(1, 'x')).toBe(true);
    expect(inSample(0, 'x')).toBe(false);
    expect(inSample(0.5, 'abc')).toBe(inSample(0.5, 'abc'));
  });
});

describe('startInsights()', () => {
  it('sends ONE summary per pageview with clicks + rage, and never the typed value', async () => {
    stop = startInsights(ctx);
    expect(stop).not.toBeNull();
    const input = document.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    input.value = 'secret@example.com';
    const b = document.getElementById('b') as HTMLElement;
    for (let i = 0; i < 3; i++)
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide')); // second pagehide must not double-send
    await flush();
    expect(beacons).toHaveLength(1);
    const s = JSON.parse(beacons[0] as string);
    expect(s).toMatchObject({
      merchantId: 'M1',
      sessionId: 'sess-1',
      rage: 1,
      abandonedFields: ['email'],
    });
    expect(s.elements['button|add to cart']).toBe(3);
    expect(beacons[0]).not.toContain('secret@example.com');
  });

  it('consent denied (GPC) → tracker never starts, zero beacons', async () => {
    (navigator as unknown as { globalPrivacyControl: boolean }).globalPrivacyControl = true;
    stop = startInsights(ctx);
    expect(stop).toBeNull();
    window.dispatchEvent(new Event('pagehide'));
    await flush();
    expect(beacons).toHaveLength(0);
  });

  it('not entitled / not sampled → off', () => {
    expect(startInsights({ ...ctx, config: { enabled: false, sampleRate: 1 } })).toBeNull();
    expect(startInsights({ ...ctx, config: { enabled: true, sampleRate: 0 } })).toBeNull();
  });
});
