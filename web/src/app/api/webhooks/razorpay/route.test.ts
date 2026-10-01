import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findEvent } = vi.hoisted(() => ({ findEvent: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })) })),
    query: { razorpayEvents: { findFirst: findEvent }, merchants: { findFirst: vi.fn().mockResolvedValue(null) } },
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  },
}));

vi.mock('@/lib/razorpay', () => ({
  validateWebhookSignature: vi.fn().mockReturnValue(true),
  TOPUP_QTYS: { topup_50: 50, topup_200: 200, topup_1000: 1000, topup_5000: 5000 },
}));

import { POST } from './route';

function req(body: object, headers: Record<string, string>) {
  return new Request('http://localhost/api/webhooks/razorpay', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(() => findEvent.mockReset());

  it('returns 200 on a signed subscription.activated', async () => {
    findEvent.mockResolvedValue(null);
    const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_1', customer_id: 'cust_1', notes: { user_id: 'u1' } } } } };
    const res = await POST(req(body, { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(200);
  });

  it('skips already-processed events (idempotent)', async () => {
    findEvent.mockResolvedValue({ id: 'evt_1', processedAt: new Date() });
    const res = await POST(req({ event: 'subscription.activated', payload: {} }, { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).idempotent).toBe(true);
  });

  it('returns 400 when signature header missing', async () => {
    const res = await POST(req({ event: 'x', payload: {} }, { 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature invalid', async () => {
    const { validateWebhookSignature } = await import('@/lib/razorpay');
    vi.mocked(validateWebhookSignature).mockReturnValueOnce(false);
    const res = await POST(req({ event: 'x', payload: {} }, { 'x-razorpay-signature': 'bad', 'x-razorpay-event-id': 'evt_2' }));
    expect(res.status).toBe(400);
  });
});
