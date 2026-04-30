import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fingerprint } from '../../apps/worker/src/steps/fingerprint.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fingerprint', () => {
  it('returns shopify on a Shopify homepage', async () => {
    server.use(http.get('https://shop.test/', () => HttpResponse.html(shopifyHtml)));
    expect(await fingerprint('shop.test')).toBe('shopify');
  });

  it('returns woocommerce on a Woo homepage', async () => {
    server.use(http.get('https://woo.test/', () => HttpResponse.html(wooHtml)));
    expect(await fingerprint('woo.test')).toBe('woocommerce');
  });

  it('returns custom when no rule matches', async () => {
    server.use(http.get('https://custom.test/', () => HttpResponse.html(customHtml)));
    expect(await fingerprint('custom.test')).toBe('custom');
  });

  it('throws on network failure (so caller / BullMQ can retry)', async () => {
    server.use(http.get('https://broken.test/', () => HttpResponse.error()));
    await expect(fingerprint('broken.test')).rejects.toThrow();
  });

  it('throws on 5xx', async () => {
    server.use(http.get('https://oops.test/', () => new HttpResponse(null, { status: 503 })));
    await expect(fingerprint('oops.test')).rejects.toThrow(/503/);
  });

  it('caps body size and still classifies', async () => {
    // 3MB of harmless content; should be truncated and classified as custom
    const big = `<html>${'x'.repeat(3_000_000)}</html>`;
    server.use(http.get('https://big.test/', () => HttpResponse.html(big)));
    expect(await fingerprint('big.test')).toBe('custom');
  });
});
