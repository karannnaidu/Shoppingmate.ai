import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

describe('proxy', () => {
  it('redirects unauthenticated /app requests to /login', async () => {
    const req = new NextRequest('https://app.shoppingmate.shop/app');
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
  });

  it('rewrites app subdomain to /app prefix', async () => {
    const req = new NextRequest('https://app.shoppingmate.shop/');
    const res = await proxy(req);
    expect(res?.headers.get('x-proxy-rewrite') || res?.headers.get('location')).toBeTruthy();
  });
});

describe('proxy — one canonical domain for logins', () => {
  const OLD = 'https://shoppingmate-web.vercel.app';
  it('sends page visits on the old vercel.app address to www.shoppingmate.shop', async () => {
    for (const path of ['/login', '/app', '/app/cases?show=all', '/', '/pricing']) {
      const res = await proxy(new NextRequest(`${OLD}${path}`));
      expect(res?.status, path).toBe(308);
      expect(res?.headers.get('location'), path).toBe(`https://www.shoppingmate.shop${path}`);
    }
  });
  it('keeps the widget, API, webhooks and files working on the old address', async () => {
    for (const path of ['/widget/v1.js', '/api/webhooks/razorpay', '/api/auth/magic-link/verify?token=x', '/favicon.ico', '/olivia.png']) {
      const res = await proxy(new NextRequest(`${OLD}${path}`));
      expect(res?.status === 308, path).toBe(false);
    }
  });
  it('leaves www.shoppingmate.shop alone', async () => {
    const res = await proxy(new NextRequest('https://www.shoppingmate.shop/login'));
    expect(res?.status).not.toBe(308);
  });
});
