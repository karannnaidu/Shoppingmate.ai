import { type AdapterType, adapterTypes, db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

export type SetAdapterArgs = {
  merchantId: string;
  type: AdapterType;
  reason: string;
};

/**
 * Manual adapter-type override. The escape hatch for ops to flip a merchant
 * to `suggest` (Tier-3 fallback) when the auto-promotion path didn't fire —
 * e.g. Cloudflare-blocked sites we already know about, shadow-DOM merchants
 * we've manually classified, or rolling back a misclassification.
 *
 * For `suggest` we mirror `promoteToSuggest`'s behaviour (update merchant +
 * emit `adapterPromotedToSuggest` with `from_adapter` and `reason`) so the
 * metric stream looks the same regardless of how the flip happened. Writing
 * the two statements inline avoids a cross-package import from cli into the
 * worker app; the logic is small enough that the duplication is acceptable.
 */
export async function setAdapter(args: SetAdapterArgs): Promise<void> {
  if (!(adapterTypes as readonly string[]).includes(args.type)) {
    throw new Error(`unknown adapter type: ${args.type}`);
  }

  const [m] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, args.merchantId));

  if (!m) throw new Error(`merchant ${args.merchantId} not found`);

  if (args.type === 'suggest') {
    if (m.adapterType === 'suggest') {
      // already on suggest — no-op, no duplicate emit
      return;
    }
    const fromAdapter = m.adapterType ?? 'unknown';
    await db
      .update(schema.merchants)
      .set({ adapterType: 'suggest', lastIndexedAt: new Date() })
      .where(eq(schema.merchants.id, args.merchantId));
    await db.insert(schema.metricEvents).values({
      merchantId: args.merchantId,
      metricName: schema.metricNames.adapterPromotedToSuggest,
      tags: { from_adapter: fromAdapter, reason: args.reason },
    });
    return;
  }

  await db
    .update(schema.merchants)
    .set({ adapterType: args.type })
    .where(eq(schema.merchants.id, args.merchantId));
}
