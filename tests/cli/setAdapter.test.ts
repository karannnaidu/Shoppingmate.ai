import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { setAdapter } from '../../packages/cli/src/commands/setAdapter.js';

const ids: string[] = [];

async function seedMerchant(opts: {
  adapterType: schema.AdapterType;
}): Promise<string> {
  const id = generateMerchantId();
  ids.push(id);
  await db.insert(schema.merchants).values({
    id,
    domain: `${id.toLowerCase()}.test`,
    allowedDomains: [`${id.toLowerCase()}.test`],
    status: 'live',
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

describe('set-adapter CLI', () => {
  it('sets adapter_type to suggest and emits adapterPromotedToSuggest', async () => {
    const id = await seedMerchant({ adapterType: 'dom' });
    await setAdapter({ merchantId: id, type: 'suggest', reason: 'cloudflare' });

    const [m] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, id));
    expect(m?.adapterType).toBe('suggest');

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
    expect(events[0]?.tags).toMatchObject({ from_adapter: 'dom', reason: 'cloudflare' });
  });

  it('sets adapter_type for non-suggest types without emitting promotion metric', async () => {
    const id = await seedMerchant({ adapterType: 'dom' });
    await setAdapter({ merchantId: id, type: 'shopify', reason: 'manual' });

    const [m] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, id));
    expect(m?.adapterType).toBe('shopify');

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

  it('rejects unknown adapter types', async () => {
    const id = await seedMerchant({ adapterType: 'dom' });
    await expect(
      setAdapter({ merchantId: id, type: 'lol' as schema.AdapterType, reason: 'x' }),
    ).rejects.toThrow(/unknown adapter type/i);
  });

  it('errors when merchant does not exist', async () => {
    await expect(
      setAdapter({ merchantId: 'SM-NOPE', type: 'suggest', reason: 'x' }),
    ).rejects.toThrow(/not found/i);
  });
});
