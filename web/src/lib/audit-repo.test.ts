// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const rows = [
  {
    id: 1,
    orderId: 'O1',
    totalCents: 25000,
    currency: 'INR',
    attributionKind: 'assisted',
    matchSource: 'cod',
    occurredAt: new Date('2026-06-14T00:00:00Z'),
    sessionId: 's1',
    lineItems: [{ sku: 'CALM-1', quantity: 1, priceCents: 25000, wasRecommended: true }],
  },
];

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => Promise.resolve(rows) }),
        }),
      }),
    }),
  },
}));

import { listConversions } from './audit-repo';

describe('audit-repo', () => {
  it('returns ledger rows', async () => {
    const out = await listConversions({ merchantId: 'SM-X', days: 30 });
    expect(out).toHaveLength(1);
    expect(out[0].orderId).toBe('O1');
    expect(out[0].matchSource).toBe('cod');
    expect(out[0].lineItems[0].sku).toBe('CALM-1');
  });
});
