import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';

const log = childLogger({ step: 'promoteToSuggest' });

/**
 * Flip a merchant's `adapter_type` to `'suggest'` (Tier-3 fallback) and emit
 * an `adapterPromotedToSuggest` metric event tagged with the prior adapter
 * and the reason. Idempotent: re-running on a merchant that's already on
 * Suggest is a no-op (no metric emit) so callers can use it freely from
 * smokeTest retries without duplicating events.
 */
export async function promoteToSuggest(merchantId: string, reason: string): Promise<void> {
  const [m] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId));

  if (!m) throw new Error(`promoteToSuggest: merchant ${merchantId} not found`);
  if (m.adapterType === 'suggest') {
    log.info({ merchantId, reason }, 'already on suggest — no-op');
    return;
  }

  const fromAdapter = m.adapterType ?? 'unknown';

  await db
    .update(schema.merchants)
    .set({ adapterType: 'suggest', lastIndexedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));

  await db.insert(schema.metricEvents).values({
    merchantId,
    metricName: schema.metricNames.adapterPromotedToSuggest,
    tags: { from_adapter: fromAdapter, reason },
  });

  log.info({ merchantId, fromAdapter, reason }, 'promoted to suggest');
}
