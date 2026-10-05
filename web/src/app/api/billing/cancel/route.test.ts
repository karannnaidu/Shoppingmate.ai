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

const { cancel } = vi.hoisted(() => ({ cancel: vi.fn().mockResolvedValue({ id: 'sub_x', status: 'cancelled' }) }));
vi.mock('@/lib/razorpay', () => ({ razorpay: { subscriptions: { cancel } } }));

vi.mock('@/lib/db', () => ({
  db: { query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', razorpaySubscriptionId: 'sub_x' }) } } },
}));

import { POST } from './route';

describe('POST /api/billing/cancel', () => {
  it('cancels the subscription at cycle end (JSON caller)', async () => {
    const res = await POST(new Request('http://localhost/api/billing/cancel', { method: 'POST' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(cancel).toHaveBeenCalledWith('sub_x', true);
  });

  it('redirects a native form submit back to billing', async () => {
    const res = await POST(
      new Request('http://localhost/api/billing/cancel', { method: 'POST', headers: { accept: 'text/html' } }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/app/billing');
  });
});
