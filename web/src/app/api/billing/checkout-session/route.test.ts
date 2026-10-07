import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: null,
  }),
}));

vi.mock('@/lib/razorpay', () => ({
  razorpay: {
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_test', short_url: 'https://rzp.io/i/abc' }),
    },
  },
  PLAN_IDS: { starter: 'plan_test_starter', growth: 'plan_test_growth', scale: 'plan_test_scale' },
}));

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

import { POST } from './route';

describe('POST /api/billing/checkout-session', () => {
  it('returns Razorpay subscription short_url', async () => {
    const req = new Request('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toContain('rzp.io');
  });

  it('subscribes to the plan the owner picked (was always Starter)', async () => {
    const { razorpay } = await import('@/lib/razorpay');
    const create = vi.mocked(razorpay.subscriptions.create);
    for (const plan of ['growth', 'scale', 'starter'] as const) {
      await POST(
        new Request('http://localhost/api/billing/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        }),
      );
      expect(create).toHaveBeenLastCalledWith(
        expect.objectContaining({ plan_id: `plan_test_${plan}`, notes: expect.objectContaining({ plan }) }),
      );
    }
  });

  it('falls back to Starter for an unknown plan', async () => {
    const { razorpay } = await import('@/lib/razorpay');
    await POST(
      new Request('http://localhost/api/billing/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'platinum' }),
      }),
    );
    expect(vi.mocked(razorpay.subscriptions.create)).toHaveBeenLastCalledWith(
      expect.objectContaining({ plan_id: 'plan_test_starter' }),
    );
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/billing/checkout-session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
