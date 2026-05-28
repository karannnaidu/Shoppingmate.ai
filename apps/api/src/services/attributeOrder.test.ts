import { describe, expect, it, vi, beforeEach } from 'vitest';
import { attributeOrder, type AttributeOrderDeps, type OrderPayload } from './attributeOrder.js';

const baseOrder = (): OrderPayload => ({
  merchantId: 'm1',
  orderId: 'ord-1',
  totalCents: 5000,
  currency: 'USD',
  visitorId: 'v1',
  occurredAt: new Date('2026-05-27T10:00:00Z'),
  lineItems: [{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }],
  matchSource: 'gtag',
});

function makeDeps(overrides: Partial<AttributeOrderDeps>): AttributeOrderDeps {
  return {
    findRecentSessionsForVisitor: vi.fn().mockResolvedValue([]),
    findRecommendationsForSessionAndSkus: vi.fn().mockResolvedValue([]),
    insertConversion: vi.fn().mockResolvedValue({ inserted: true }),
    attributionWindowDays: 7,
    ...overrides,
  };
}

describe('attributeOrder', () => {
  it('returns no rows when visitor has no session in window', async () => {
    const deps = makeDeps({});
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote).toEqual([]);
    expect(result.missReason).toBe('no_visitor_in_window');
    expect(deps.insertConversion).not.toHaveBeenCalled();
  });

  it('writes influenced row when visitor has session in window but no recommendation match', async () => {
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
        { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
      ]),
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote).toEqual(['influenced']);
    expect(deps.insertConversion).toHaveBeenCalledTimes(1);
    const [row] = (deps.insertConversion as any).mock.calls[0];
    expect(row.attributionKind).toBe('influenced');
    expect(row.sessionId).toBe('sess-1');
    expect(row.lineItems[0].wasRecommended).toBe(false);
  });

  it('writes both assisted and influenced when recommendation matches', async () => {
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
        { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
      ]),
      findRecommendationsForSessionAndSkus: vi.fn().mockResolvedValue([
        { sessionId: 'sess-1', sku: 'SKU-A' },
      ]),
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote.sort()).toEqual(['assisted', 'influenced']);
    expect(deps.insertConversion).toHaveBeenCalledTimes(2);
    const assistedRow = (deps.insertConversion as any).mock.calls.find(
      ([r]: any[]) => r.attributionKind === 'assisted',
    )[0];
    expect(assistedRow.lineItems[0].wasRecommended).toBe(true);
  });

  it('is idempotent: skips when insert returns inserted=false', async () => {
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
        { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
      ]),
      insertConversion: vi.fn().mockResolvedValue({ inserted: false }),
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote).toEqual([]);
    expect(result.skipped).toEqual(['influenced']);
  });

  it('excludes sessions ended outside the 7d window', async () => {
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([]), // repo filters by window
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.missReason).toBe('no_visitor_in_window');
  });

  it('picks the most recent session for influenced attribution', async () => {
    const older = { id: 'sess-old', endedAt: new Date('2026-05-22T10:00:00Z') };
    const newer = { id: 'sess-new', endedAt: new Date('2026-05-26T10:00:00Z') };
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([newer, older]),
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote).toEqual(['influenced']);
    const [row] = (deps.insertConversion as any).mock.calls[0];
    expect(row.sessionId).toBe('sess-new');
  });

  it('reports no_recommendation_match (not no_visitor_in_window) when idempotent-skipping with sessions present', async () => {
    const deps = makeDeps({
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
        { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
      ]),
      insertConversion: vi.fn().mockResolvedValue({ inserted: false }),
    });
    const result = await attributeOrder(baseOrder(), deps);
    expect(result.wrote).toEqual([]);
    expect(result.skipped).toEqual(['influenced']);
    expect(result.missReason).toBe('no_recommendation_match');
  });
});
