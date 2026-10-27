import { describe, expect, it } from 'vitest';
import { liveToolDeclarations, summarizeForLive, voiceToolSurface } from './liveTools.js';

const tools = [
  { type: 'function' as const, function: { name: 'products.search', description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } } } } },
  { type: 'function' as const, function: { name: 'site.scroll_to', description: 'scroll', parameters: { type: 'object', properties: {} } } },
];

describe('liveToolDeclarations', () => {
  it('sanitizes dotted names and maps them back exactly (underscores in the original survive)', () => {
    const { declarations, toCanonical } = liveToolDeclarations(tools);
    const names = declarations[0]!.functionDeclarations.map((d) => d.name);
    expect(names).toEqual(['products_search', 'site_scroll_to']);
    expect(toCanonical('products_search')).toBe('products.search');
    expect(toCanonical('site_scroll_to')).toBe('site.scroll_to');
    expect(toCanonical('made_up')).toBe(null);
    expect(declarations[0]!.functionDeclarations[0]!.parametersJsonSchema).toEqual(tools[0]!.function.parameters);
  });
});

describe('summarizeForLive', () => {
  it('turns product results into short card facts, never prices to speak', () => {
    const r = summarizeForLive('products.search', {
      ok: true,
      value: [{ title: 'Sleep Mantra', sku: 'sleep-mantra', priceFormatted: '₹4,500', description: 'x'.repeat(2000) }],
    });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r).length).toBeLessThan(800);
    expect(r.shown).toEqual([{ title: 'Sleep Mantra', sku: 'sleep-mantra' }]);
    expect(String(r.note)).toMatch(/card/i);
  });
  it('passes failure reasons through so Olivia can be honest', () => {
    expect(summarizeForLive('cart.add', { ok: false, kind: 'unsupported', reason: 'sku not found' })).toMatchObject({ ok: false, reason: 'sku not found' });
  });
  it('caps any large value', () => {
    const r = summarizeForLive('page.read', { ok: true, value: { text: 'y'.repeat(20_000) } });
    expect(JSON.stringify(r).length).toBeLessThan(4_200);
  });
});

describe('voiceToolSurface', () => {
  it('never gives the voice model checkout.place (the visitor taps Place Order)', () => {
    const all = [
      { type: 'function' as const, function: { name: 'checkout.fill', description: '', parameters: {} } },
      { type: 'function' as const, function: { name: 'checkout.place', description: '', parameters: {} } },
    ];
    expect(voiceToolSurface(all).map((t) => t.function.name)).toEqual(['checkout.fill']);
  });
});
