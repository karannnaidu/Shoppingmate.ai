import { db, schema, submitSupportCase } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Voice confirmations repeat ("yes, please book it" after "yes, that's right"):
// one request per need per conversation, updated rather than duplicated.
let merchantId: string;
const base = {
  type: 'booking' as const,
  summary: 'Demo meeting next Tuesday 3pm',
  details: { company: 'Glow Lamps' },
  contactName: 'Ravi',
  contactPhone: '9845012345',
  contactEmail: null,
  urgency: 'normal' as const,
  sentiment: 'neutral' as const,
  sessionId: 'ws_dedupe1',
  visitorId: null,
  orderId: null,
};

beforeAll(async () => {
  delete process.env.RESEND_API_KEY;
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({ id: merchantId, domain: 'dd.test', allowedDomains: ['dd.test'], status: 'live', adapterConfig: {} });
});
afterAll(async () => {
  await db.delete(schema.supportCases).where(eq(schema.supportCases.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('submitSupportCase dedupe', () => {
  it('a repeat in the same conversation updates the first request', async () => {
    const a = await submitSupportCase({ ...base, merchantId });
    const b = await submitSupportCase({ ...base, merchantId, details: { company: 'Glow Labs' }, summary: 'Demo meeting next Tuesday 3pm (Glow Labs)' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.id).toBe(a.id);
    const rows = await db.select().from(schema.supportCases).where(eq(schema.supportCases.merchantId, merchantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ company: 'Glow Labs' });
  });
  it('a different need in the same conversation is its own request', async () => {
    const c = await submitSupportCase({ ...base, merchantId, type: 'feedback', summary: 'Loved the demo' });
    const rows = await db.select().from(schema.supportCases).where(eq(schema.supportCases.merchantId, merchantId));
    expect(c.ok).toBe(true);
    expect(rows).toHaveLength(2);
  });
});
