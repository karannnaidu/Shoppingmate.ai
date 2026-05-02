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
const magentoHtml = readFileSync(resolve(fixturesDir, 'magentoHomepage.html'), 'utf8');
const bcHtml = readFileSync(resolve(fixturesDir, 'bigcommerceHomepage.html'), 'utf8');
const wixHtml = readFileSync(resolve(fixturesDir, 'wixHomepage.html'), 'utf8');
const sqHtml = readFileSync(resolve(fixturesDir, 'squarespaceHomepage.html'), 'utf8');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fingerprint', () => {
  it('shopify → platform=shopify, detected=null', async () => {
    server.use(http.get('https://shop.test/', () => HttpResponse.html(shopifyHtml)));
    expect(await fingerprint('shop.test')).toEqual({ platform: 'shopify', detectedPlatform: null });
  });

  it('woo → platform=woocommerce, detected=null', async () => {
    server.use(http.get('https://woo.test/', () => HttpResponse.html(wooHtml)));
    expect(await fingerprint('woo.test')).toEqual({ platform: 'woocommerce', detectedPlatform: null });
  });

  it('custom (no rule) → platform=custom, detected=null', async () => {
    server.use(http.get('https://custom.test/', () => HttpResponse.html(customHtml)));
    expect(await fingerprint('custom.test')).toEqual({ platform: 'custom', detectedPlatform: null });
  });

  it('magento → platform=custom, detected=magento', async () => {
    server.use(http.get('https://m.test/', () => HttpResponse.html(magentoHtml)));
    expect(await fingerprint('m.test')).toEqual({ platform: 'custom', detectedPlatform: 'magento' });
  });

  it('bigcommerce → platform=custom, detected=bigcommerce', async () => {
    server.use(http.get('https://bc.test/', () => HttpResponse.html(bcHtml)));
    expect(await fingerprint('bc.test')).toEqual({ platform: 'custom', detectedPlatform: 'bigcommerce' });
  });

  it('wix → platform=custom, detected=wix', async () => {
    server.use(http.get('https://wix.test/', () => HttpResponse.html(wixHtml)));
    expect(await fingerprint('wix.test')).toEqual({ platform: 'custom', detectedPlatform: 'wix' });
  });

  it('squarespace → platform=custom, detected=squarespace', async () => {
    server.use(http.get('https://sq.test/', () => HttpResponse.html(sqHtml)));
    expect(await fingerprint('sq.test')).toEqual({ platform: 'custom', detectedPlatform: 'squarespace' });
  });

  it('throws on network failure', async () => {
    server.use(http.get('https://broken.test/', () => HttpResponse.error()));
    await expect(fingerprint('broken.test')).rejects.toThrow();
  });

  it('throws on 5xx', async () => {
    server.use(http.get('https://oops.test/', () => new HttpResponse(null, { status: 503 })));
    await expect(fingerprint('oops.test')).rejects.toThrow(/503/);
  });
});
