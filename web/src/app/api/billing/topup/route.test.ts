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

vi.mock('@/lib/razorpay', () => ({
  razorpay: {
    paymentLink: { create: vi.fn().mockResolvedValue({ id: 'plink_x', short_url: 'https://rzp.io/i/pl' }) },
  },
  TOPUP_AMOUNTS: {
    topup_50: { amount: 1900, label: '50' },
    topup_200: { amount: 5900, label: '200' },
    topup_1000: { amount: 19900, label: '1,000' },
    topup_5000: { amount: 79900, label: '5,000' },
  },
  BILLING_CURRENCY: 'USD',
}));

import { POST } from './route';

describe('POST /api/billing/topup', () => {
  it('returns a payment-link short_url for a valid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_200' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    const json = await res.json();
    expect(json.url).toContain('rzp.io');
  });

  it('rejects an invalid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_lol' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
