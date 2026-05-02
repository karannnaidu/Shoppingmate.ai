import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../apps/worker/src/steps/fingerprintRules/index.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');

describe('detectPlatform', () => {
  it('detects Shopify by Shopify.shop variable', () => {
    expect(detectPlatform(shopifyHtml, {}).platform).toBe('shopify');
  });

  it('detects Shopify by cdn.shopify.com asset', () => {
    const html =
      '<html><head><link rel="stylesheet" href="https://cdn.shopify.com/x.css"/></head></html>';
    expect(detectPlatform(html, {}).platform).toBe('shopify');
  });

  it('falls back to custom when nothing matches', () => {
    expect(detectPlatform(customHtml, {}).platform).toBe('custom');
  });
});

describe('detectPlatform — WooCommerce', () => {
  it('detects Woo by generator meta', () => {
    expect(detectPlatform(wooHtml, {}).platform).toBe('woocommerce');
  });

  it('detects Woo by woocommerce body class', () => {
    const html = '<html><body class="woocommerce">x</body></html>';
    expect(detectPlatform(html, {}).platform).toBe('woocommerce');
  });

  it('detects Woo by wp-content/plugins/woocommerce path', () => {
    const html =
      '<html><body><script src="/wp-content/plugins/woocommerce/x.js"></script></body></html>';
    expect(detectPlatform(html, {}).platform).toBe('woocommerce');
  });

  it('Shopify wins when both signals are present (Shopify rule registered first)', () => {
    const html =
      '<html><body class="woocommerce"><script>window.Shopify={};</script></body></html>';
    expect(detectPlatform(html, {}).platform).toBe('shopify');
  });
});
