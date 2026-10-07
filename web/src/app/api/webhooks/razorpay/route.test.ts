import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findEvent, findOwner, inserted, updated } = vi.hoisted(() => ({
  findEvent: vi.fn(),
  findOwner: vi.fn(),
  inserted: [] as unknown[],
  updated: [] as unknown[],
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((v: unknown) => {
        inserted.push(v);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
    query: {
      razorpayEvents: { findFirst: findEvent },
      merchants: { findFirst: vi.fn().mockResolvedValue(null) },
      merchantOwners: { findFirst: findOwner },
    },
    update: vi.fn(() => ({
      set: (v: unknown) => {
        updated.push(v);
        return { where: () => Promise.resolve() };
      },
    })),
  },
}));

vi.mock('@/lib/razorpay', () => ({
  validateWebhookSignature: vi.fn().mockReturnValue(true),
  TOPUP_QTYS: { topup_100: 100, topup_500: 500, topup_1000: 1000 },
  PLAN_IDS: { starter: 'plan_s', growth: 'plan_g', scale: 'plan_x' },
}));

import { POST } from './route';
import { planFromSubscription } from '@/lib/plan-from-subscription';

function req(body: object, headers: Record<string, string>) {
  return new Request('http://localhost/api/webhooks/razorpay', { method: 'POST', headers, body: JSON.stringify(body) });
}
const signed = (id: string) => ({ 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': id });

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(() => {
    findEvent.mockReset();
    findOwner.mockReset();
    inserted.length = 0;
    updated.length = 0;
  });

  it('returns 200 on a signed subscription.activated', async () => {
    findEvent.mockResolvedValue(null);
    findOwner.mockResolvedValue(null);
    const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_1', customer_id: 'cust_1', notes: { user_id: 'u1' } } } } };
    const res = await POST(req(body, signed('evt_1')));
    expect(res.status).toBe(200);
  });

  it('creates the new store on the plan that was bought', async () => {
    findEvent.mockResolvedValue(null);
    findOwner.mockResolvedValue(null);
    const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_2', customer_id: 'c', plan_id: 'plan_g', notes: { user_id: 'u2', plan: 'growth' } } } } };
    await POST(req(body, signed('evt_2')));
    expect(inserted.some((v) => (v as { plan?: string }).plan === 'growth')).toBe(true);
  });

  it('keeps an existing owner on their store and switches the plan (no second store)', async () => {
    findEvent.mockResolvedValue(null);
    findOwner.mockResolvedValue({ userId: 'u3', merchantId: 'SM-OLD' });
    const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_3', customer_id: 'c', plan_id: 'plan_x', notes: { user_id: 'u3' } } } } };
    await POST(req(body, signed('evt_3')));
    expect(updated.some((v) => (v as { plan?: string }).plan === 'scale')).toBe(true);
    expect(inserted.some((v) => (v as { plan?: string }).plan)).toBe(false);
  });

  it('adds a top-up to the balance instead of overwriting it', async () => {
    findEvent.mockResolvedValue(null);
    const body = { event: 'payment_link.paid', payload: { payment_link: { entity: { notes: { topup_key: 'topup_500', merchant_id: 'SM-1' } } } } };
    await POST(req(body, signed('evt_4')));
    const set = updated.find((v) => (v as Record<string, unknown>).topupBalance !== undefined) as { topupBalance: unknown };
    expect(typeof set.topupBalance).toBe('object'); // a SQL increment, not the literal 500
  });

  it('skips already-processed events (idempotent)', async () => {
    findEvent.mockResolvedValue({ id: 'evt_1', processedAt: new Date() });
    const res = await POST(req({ event: 'subscription.activated', payload: {} }, signed('evt_1')));
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

describe('planFromSubscription', () => {
  const ids = { starter: 'plan_s', growth: 'plan_g', scale: 'plan_x' };
  it('prefers the checkout note, then the plan id, then starter', () => {
    expect(planFromSubscription({ notes: { plan: 'scale' } }, ids)).toBe('scale');
    expect(planFromSubscription({ plan_id: 'plan_g' }, ids)).toBe('growth');
    expect(planFromSubscription({ plan_id: 'unknown' }, ids)).toBe('starter');
  });
});
