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
  PLAN_IDS: { starter: 'plan_test_starter' },
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

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/billing/checkout-session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
