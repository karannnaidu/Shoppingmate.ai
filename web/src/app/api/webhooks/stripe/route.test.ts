import { describe, expect, it, vi, beforeEach } from 'vitest';

const { insertMerchant, insertOwner, insertEvent, findEvent } = vi.hoisted(() => ({
  insertMerchant: vi.fn(),
  insertOwner: vi.fn(),
  insertEvent: vi.fn(),
  findEvent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    query: { stripeEvents: { findFirst: findEvent } },
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn().mockImplementation((body, _sig, _secret) => JSON.parse(body)),
    },
  },
}));

import { POST } from './route';

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    findEvent.mockReset();
  });

  it('returns 200 on signed checkout.session.completed', async () => {
    findEvent.mockResolvedValue(null);
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test',
          subscription: 'sub_test',
          metadata: { user_id: 'u1' },
        },
      },
    };
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('skips already-processed events (idempotent)', async () => {
    findEvent.mockResolvedValue({ id: 'evt_1', processedAt: new Date() });
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } };
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });

  it('returns 400 when signature missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
