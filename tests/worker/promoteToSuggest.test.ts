import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { promoteToSuggest } from '../../apps/worker/src/steps/promoteToSuggest.js';

const ids: string[] = [];

async function seedMerchant(opts: {
  adapterType: schema.AdapterType;
  status?: schema.MerchantStatus;
}): Promise<string> {
  const id = generateMerchantId();
  ids.push(id);
  await db.insert(schema.merchants).values({
    id,
    domain: `${id.toLowerCase()}.test`,
    allowedDomains: [`${id.toLowerCase()}.test`],
    status: opts.status ?? 'live',
    adapterType: opts.adapterType,
    adapterConfig: {},
  });
  return id;
}

afterEach(async () => {
  for (const id of ids.splice(0)) {
    await db.delete(schema.metricEvents).where(eq(schema.metricEvents.merchantId, id));
    await db.delete(schema.merchants).where(eq(schema.merchants.id, id));
  }
});

describe('promoteToSuggest', () => {
  it('updates adapter_type to suggest and refreshes last_indexed_at', async () => {
    const id = await seedMerchant({ adapterType: 'dom' });
    const before = new Date();

    await promoteToSuggest(id, 'cloudflare_block_detected');

    const [m] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, id));
    expect(m).toBeDefined();
    expect(m?.adapterType).toBe('suggest');
    expect(m?.lastIndexedAt).not.toBeNull();
    if (m?.lastIndexedAt) {
      expect(m.lastIndexedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    }
  });

  it('emits adapterPromotedToSuggest with from_adapter and reason tags', async () => {
    const id = await seedMerchant({ adapterType: 'dom' });
    await promoteToSuggest(id, 'action_cap');

    const events = await db
      .select()
      .from(schema.metricEvents)
      .where(
        and(
          eq(schema.metricEvents.merchantId, id),
          eq(schema.metricEvents.metricName, schema.metricNames.adapterPromotedToSuggest),
        ),
      );
    expect(events).toHaveLength(1);
    expect(events[0]?.tags).toMatchObject({ from_adapter: 'dom', reason: 'action_cap' });
  });

  it('is idempotent — re-running on a Suggest merchant is a no-op without emit', async () => {
    const id = await seedMerchant({ adapterType: 'suggest' });
    await promoteToSuggest(id, 'duplicate_call');

    const events = await db
      .select()
      .from(schema.metricEvents)
      .where(
        and(
          eq(schema.metricEvents.merchantId, id),
          eq(schema.metricEvents.metricName, schema.metricNames.adapterPromotedToSuggest),
        ),
      );
    expect(events).toHaveLength(0);
  });

  it('throws when merchant does not exist', async () => {
    await expect(promoteToSuggest('SM-NOPE', 'x')).rejects.toThrow(/not found/i);
  });
});
