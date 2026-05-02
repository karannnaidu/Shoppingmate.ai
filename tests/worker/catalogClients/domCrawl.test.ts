import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchDomCatalog } from '../../../apps/worker/src/steps/catalogClients/domCrawl.js';

const sitemapXml = readFileSync(
  resolve(import.meta.dirname, '..', '..', 'fixtures', 'sitemap.xml'),
  'utf8',
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchDomCatalog', () => {
  it('parses sitemap, filters product URLs, calls extractor for each, returns ok', async () => {
    server.use(http.get('https://custom.test/sitemap.xml', () => HttpResponse.text(sitemapXml)));

    const renderedUrls: string[] = [];
    const result = await fetchDomCatalog('custom.test', {
      cap: 500,
      timeoutMs: 90_000,
      // Test injects fakes for Playwright + LLM extractor
      renderHtml: async (url) => {
        renderedUrls.push(url);
        return `<html><body><h1>Title for ${url}</h1></body></html>`;
      },
      extractProduct: async (url, html) => ({
        sku: url.split('/').pop() ?? 'unknown',
        title: `Title for ${url}`,
        description: 'desc',
        imageUrl: null,
        productUrl: url,
        priceCents: 999,
        currency: 'USD',
        inStock: true,
        variants: [],
        source: 'dom_crawl',
      }),
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products.map((p) => p.sku)).toEqual(['widget-a', 'widget-b']);
    expect(renderedUrls).toEqual([
      'https://custom.test/products/widget-a',
      'https://custom.test/products/widget-b',
    ]);
    expect(result.expected).toBe(2);
  });

  it('returns failed when sitemap missing', async () => {
    server.use(
      http.get('https://custom.test/sitemap.xml', () => new HttpResponse(null, { status: 404 })),
    );
    const result = await fetchDomCatalog('custom.test', {
      cap: 500,
      timeoutMs: 90_000,
      renderHtml: async () => '',
      extractProduct: async () => null,
    });
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.reason).toBe('no_sitemap');
  });
});
