import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: null,
  }),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/x' }),
      },
    },
  },
  PRICE_IDS: { starter_monthly: 'price_test_starter' },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { POST } from './route';

describe('POST /api/billing/checkout-session', () => {
  it('returns Stripe Checkout URL', async () => {
    const req = new Request('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/billing/checkout-session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
