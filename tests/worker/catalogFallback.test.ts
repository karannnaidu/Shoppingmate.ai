import { describe, expect, it, vi } from 'vitest';
import type { CatalogClientResult } from '../../apps/worker/src/steps/catalogClients/shopify.js';
import {
  catalogEndpointBlocked,
  fetchCatalogWithFallback,
} from '../../apps/worker/src/steps/catalogFallback.js';

const ok: CatalogClientResult = { kind: 'ok', products: [], expected: 0 };
const failed = (reason: string): CatalogClientResult => ({ kind: 'failed', reason });

describe('catalogEndpointBlocked', () => {
  it.each(['http_401', 'http_403', 'http_404', 'http_429', 'fetch_error'])(
    'treats %s as recoverable by DOM crawl',
    (reason) => {
      expect(catalogEndpointBlocked(reason)).toBe(true);
    },
  );
  it.each(['http_500', 'http_503', 'http_200', 'ratio_0.50'])(
    'does NOT fall back on %s (store down / not a block)',
    (reason) => {
      expect(catalogEndpointBlocked(reason)).toBe(false);
    },
  );
});

describe('fetchCatalogWithFallback', () => {
  it('returns the primary result and never calls fallback when primary succeeds', async () => {
    const fallback = vi.fn(async () => ok);
    const out = await fetchCatalogWithFallback(async () => ok, fallback, 'shop.test');
    expect(out).toEqual({ result: ok, usedFallback: false });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to DOM crawl when the storefront endpoint is blocked', async () => {
    const domResult: CatalogClientResult = {
      kind: 'ok',
      products: [
        {
          sku: 'x',
          title: 'X',
          description: null,
          imageUrl: null,
          productUrl: 'https://shop.test/x',
          variants: [],
          priceCents: 100,
          currency: 'USD',
          inStock: true,
          source: 'dom_crawl',
        },
      ],
      expected: 1,
    };
    const out = await fetchCatalogWithFallback(
      async () => failed('http_403'),
      async () => domResult,
      'shop.test',
    );
    expect(out.usedFallback).toBe(true);
    expect(out.result).toEqual(domResult);
  });

  it('does NOT fall back on a 5xx (store down)', async () => {
    const fallback = vi.fn(async () => ok);
    const out = await fetchCatalogWithFallback(async () => failed('http_503'), fallback, 'shop.test');
    expect(out.usedFallback).toBe(false);
    expect(out.result).toEqual(failed('http_503'));
    expect(fallback).not.toHaveBeenCalled();
  });

  it('does not fall back when no fallback is provided', async () => {
    const out = await fetchCatalogWithFallback(async () => failed('http_404'), null, 'shop.test');
    expect(out.usedFallback).toBe(false);
    expect(out.result).toEqual(failed('http_404'));
  });

  it('reports a combined reason when both primary and fallback fail', async () => {
    const out = await fetchCatalogWithFallback(
      async () => failed('http_403'),
      async () => failed('dom_empty'),
      'shop.test',
    );
    expect(out.usedFallback).toBe(true);
    expect(out.result).toEqual({ kind: 'failed', reason: 'primary_http_403_fallback_dom_empty' });
  });
});
