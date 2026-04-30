import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../apps/worker/src/steps/fingerprintRules/index.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

describe('detectPlatform', () => {
  it('detects Shopify by Shopify.shop variable', () => {
    expect(detectPlatform(shopifyHtml, {})).toBe('shopify');
  });

  it('detects Shopify by cdn.shopify.com asset', () => {
    const html =
      '<html><head><link rel="stylesheet" href="https://cdn.shopify.com/x.css"/></head></html>';
    expect(detectPlatform(html, {})).toBe('shopify');
  });

  it('falls back to custom when nothing matches', () => {
    expect(detectPlatform(customHtml, {})).toBe('custom');
  });
});
