import { db, schema } from '@shoppingmate/db';
import { selectorCacheRepo } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let merchantId: string;

beforeAll(async () => {
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({
    id: merchantId,
    domain: 'selcache.test',
    allowedDomains: ['selcache.test'],
    status: 'live',
    adapterConfig: {},
  });
});

beforeEach(async () => {
  await db.delete(schema.selectorCache).where(eq(schema.selectorCache.merchantId, merchantId));
});

afterAll(async () => {
  await db.delete(schema.selectorCache).where(eq(schema.selectorCache.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('selectorCacheRepo', () => {
  it('upsertHealed writes source=llm_resolved', async () => {
    await selectorCacheRepo.upsertHealed(merchantId, 'hash1', 'add_to_cart_button', '#buy');
    const r = await selectorCacheRepo.get(merchantId, 'hash1', 'add_to_cart_button');
    expect(r?.source).toBe('llm_resolved');
    expect(r?.resolvedSelector).toBe('#buy');
  });

  it('upsertHealed never overwrites merchant_override', async () => {
    await selectorCacheRepo.put(
      merchantId,
      'hash1',
      'add_to_cart_button',
      '.buy',
      'merchant_override',
    );
    await selectorCacheRepo.upsertHealed(merchantId, 'hash1', 'add_to_cart_button', '#evil');
    const r = await selectorCacheRepo.get(merchantId, 'hash1', 'add_to_cart_button');
    expect(r?.source).toBe('merchant_override');
    expect(r?.resolvedSelector).toBe('.buy');
  });

  it('markOverrideFailing sets last_test_passed=false + suggested_replacement', async () => {
    await selectorCacheRepo.put(merchantId, 'h', 'k', '.x', 'merchant_override');
    await selectorCacheRepo.markOverrideFailing(merchantId, 'h', 'k', '#better');
    const r = await selectorCacheRepo.get(merchantId, 'h', 'k');
    expect(r?.lastTestPassed).toBe(false);
    expect(r?.suggestedReplacement).toBe('#better');
    expect(r?.resolvedSelector).toBe('.x'); // unchanged
  });

  it('markPassed marks the row as passing', async () => {
    await selectorCacheRepo.put(merchantId, 'h2', 'k', '.x', 'auto');
    await selectorCacheRepo.markPassed(merchantId, 'h2', 'k');
    const r = await selectorCacheRepo.get(merchantId, 'h2', 'k');
    expect(r?.lastTestPassed).toBe(true);
  });
});
