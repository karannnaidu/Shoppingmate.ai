import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { sessionRoute } from './session.js';

vi.mock('@shoppingmate/db', async () => {
  const merchants = [
    {
      id: 'SM-TST001',
      allowedDomains: ['merchant.example.com'],
      status: 'live',
    },
  ];
  return {
    db: {
      select: () => ({
        from: () => ({
          where: (predicate: { merchantId: string }) => ({
            limit: async () => {
              const id = predicate?.merchantId ?? 'SM-TST001';
              return merchants.filter((m) => m.id === id);
            },
          }),
        }),
      }),
    },
    schema: { merchants: { id: 'id', allowedDomains: 'allowedDomains' } },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, value: string) => ({ merchantId: value }),
}));

const app = new Hono();
app.route('/v1/session', sessionRoute);

describe('POST /v1/session', () => {
  it('returns sessionId, wsToken and wsUrl when origin matches and merchant is allowed', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://merchant.example.com',
        referer: 'https://merchant.example.com/page',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toMatch(/^ws_/);
    expect(body.wsToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(body.wsUrl).toContain('/v1/widget/');
    expect(body.wsUrl).toContain('token=');
  });

  it('rejects when origin does not match domain', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        referer: 'https://attacker.example/',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects unknown merchant', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://merchant.example.com',
        referer: 'https://merchant.example.com/',
      },
      body: JSON.stringify({ merchantId: 'SM-NOPE99', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects domain not in merchant allowlist', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://other.example.com',
        referer: 'https://other.example.com/',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'other.example.com' }),
    });
    expect(res.status).toBe(403);
  });
});
