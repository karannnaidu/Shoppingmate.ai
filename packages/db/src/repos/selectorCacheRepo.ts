import { and, eq } from 'drizzle-orm';
import { db } from '../client.js';
import {
  type SelectorCacheRow,
  type SelectorSource,
  selectorCache,
} from '../schema/selectorCache.js';

export const selectorCacheRepo = {
  async get(merchantId: string, hash: string, key: string): Promise<SelectorCacheRow | null> {
    const rows = await db
      .select()
      .from(selectorCache)
      .where(
        and(
          eq(selectorCache.merchantId, merchantId),
          eq(selectorCache.pageTemplateHash, hash),
          eq(selectorCache.selectorKey, key),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  async put(
    merchantId: string,
    hash: string,
    key: string,
    selector: string,
    source: SelectorSource,
  ): Promise<void> {
    const now = new Date();
    await db
      .insert(selectorCache)
      .values({
        merchantId,
        pageTemplateHash: hash,
        selectorKey: key,
        resolvedSelector: selector,
        source,
        locked: source === 'merchant_override',
        overrideLockedAt: source === 'merchant_override' ? now : null,
      })
      .onConflictDoUpdate({
        target: [
          selectorCache.merchantId,
          selectorCache.pageTemplateHash,
          selectorCache.selectorKey,
        ],
        set: {
          resolvedSelector: selector,
          source,
          locked: source === 'merchant_override',
          overrideLockedAt: source === 'merchant_override' ? now : null,
          lastTestedAt: now,
        },
      });
  },

  async upsertHealed(
    merchantId: string,
    hash: string,
    key: string,
    selector: string,
  ): Promise<void> {
    const existing = await this.get(merchantId, hash, key);
    if (existing?.source === 'merchant_override') return; // override-permanence
    const now = new Date();
    await db
      .insert(selectorCache)
      .values({
        merchantId,
        pageTemplateHash: hash,
        selectorKey: key,
        resolvedSelector: selector,
        source: 'llm_resolved',
        locked: false,
        lastTestedAt: now,
        lastTestPassed: true,
      })
      .onConflictDoUpdate({
        target: [
          selectorCache.merchantId,
          selectorCache.pageTemplateHash,
          selectorCache.selectorKey,
        ],
        set: {
          resolvedSelector: selector,
          source: 'llm_resolved',
          lastTestedAt: now,
          lastTestPassed: true,
        },
      });
  },

  async markOverrideFailing(
    merchantId: string,
    hash: string,
    key: string,
    suggestion: string | null,
  ): Promise<void> {
    await db
      .update(selectorCache)
      .set({
        lastTestPassed: false,
        lastTestedAt: new Date(),
        suggestedReplacement: suggestion,
      })
      .where(
        and(
          eq(selectorCache.merchantId, merchantId),
          eq(selectorCache.pageTemplateHash, hash),
          eq(selectorCache.selectorKey, key),
        ),
      );
  },

  async markPassed(merchantId: string, hash: string, key: string): Promise<void> {
    await db
      .update(selectorCache)
      .set({ lastTestPassed: true, lastTestedAt: new Date() })
      .where(
        and(
          eq(selectorCache.merchantId, merchantId),
          eq(selectorCache.pageTemplateHash, hash),
          eq(selectorCache.selectorKey, key),
        ),
      );
  },
};
