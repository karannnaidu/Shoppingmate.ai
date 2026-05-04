// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: { query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', stripeCustomerId: 'cus_x' }) } } },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/y' }) } },
  },
  PRICE_IDS: {
    topup_50: 'price_t50', topup_200: 'price_t200', topup_1000: 'price_t1000', topup_5000: 'price_t5000',
  },
  TOPUP_QTYS: { topup_50: 50, topup_200: 200, topup_1000: 1000, topup_5000: 5000 },
}));

import { POST } from './route';

describe('POST /api/billing/topup', () => {
  it('returns Checkout URL for valid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_200' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    const json = await res.json();
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('rejects invalid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_lol' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
