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

const updateMerchant = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      alerts: { findFirst: vi.fn().mockResolvedValue({ id: 'a1', merchantId: 'SM-X', kind: 'override_failing', payload: { selector_key: 'add_to_cart', suggested: "button[data-action='add-to-cart']" } }) },
      merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', adapterConfig: { type: 'shopify' } }) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateMerchant })) })),
  },
}));

import { POST } from './route';

describe('POST /api/alerts/[id]/accept', () => {
  it('marks alert resolved and writes selector override', async () => {
    const req = new Request('http://localhost/api/alerts/a1/accept', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(303);
    expect(updateMerchant).toHaveBeenCalled();
  });
});
