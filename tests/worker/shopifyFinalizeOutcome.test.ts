import { describe, expect, it } from 'vitest';
import { shopifyFinalizeOutcome } from '../../apps/worker/src/steps/shopifyFinalizeOutcome.js';

describe('shopifyFinalizeOutcome()', () => {
  it('storefront catalog (real numeric variant ids) → live + transactional enabled', () => {
    expect(shopifyFinalizeOutcome('shopify_storefront')).toEqual({
      status: 'live',
      transactionalDisabled: false,
      lastError: null,
    });
  });

  it('dom-crawl fallback (blocked /products.json → no variant ids) → degraded + transactional disabled', () => {
    const outcome = shopifyFinalizeOutcome('dom_crawl');
    expect(outcome.status).toBe('degraded');
    expect(outcome.transactionalDisabled).toBe(true);
    expect(outcome.lastError).toMatch(/variant/i);
  });
});
