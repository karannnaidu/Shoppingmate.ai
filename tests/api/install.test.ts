import { db, schema } from '@shoppingmate/db';
import { createRedisConnection, onboardingQueue } from '@shoppingmate/jobs';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { installRoute } from '../../apps/api/src/routes/install.js';

const app = new Hono();
app.route('/v1/install', installRoute);

const redis = createRedisConnection();

async function cleanupMerchant(domain: string): Promise<void> {
  await db.delete(schema.merchants).where(eq(schema.merchants.domain, domain));
}

async function flushRateLimits(merchantId: string, ip: string): Promise<void> {
  await redis.del(`rl:merchant:${merchantId}`, `rl:ip:${ip}`);
}

async function provision(domain: string, allowedDomains?: string[]): Promise<string> {
  const id = generateMerchantId();
  await db.insert(schema.merchants).values({
    id,
    domain,
    allowedDomains: allowedDomains ?? [domain],
    status: 'pending',
  });
  return id;
}

function call(body: object, headers: Record<string, string> = {}): Promise<Response> {
  return app.request('/v1/install', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test',
      'x-real-ip': '127.0.0.1',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await db.delete(schema.installAttempts);
});

afterAll(async () => {
  await onboardingQueue.close();
  await redis.quit();
});

describe('POST /v1/install', () => {
  it('happy path: pending -> enqueued -> status=onboarding', async () => {
    const domain = 'happy.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');
    const before = await onboardingQueue.getJobCounts('waiting', 'active');

    const res = await call(
      { merchantId, domain, userAgent: 'test', referrer: null },
      { origin: `https://${domain}` },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('onboarding');

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId));
    expect(m?.status).toBe('onboarding');
    expect(m?.lastInstallAt).toBeInstanceOf(Date);

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.outcome).toBe('enqueued');

    const after = await onboardingQueue.getJobCounts('waiting', 'active');
    expect((after.waiting ?? 0) + (after.active ?? 0)).toBeGreaterThan(
      (before.waiting ?? 0) + (before.active ?? 0),
    );

    await cleanupMerchant(domain);
  });

  it('idempotency: repeat calls on live merchant noop', async () => {
    const domain = 'idem.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await db
      .update(schema.merchants)
      .set({ status: 'live', platform: 'shopify', lastFingerprintedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    await flushRateLimits(merchantId, '127.0.0.1');

    for (let i = 0; i < 3; i++) {
      const res = await call(
        { merchantId, domain, userAgent: 'test' },
        { origin: `https://${domain}` },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json.status).toBe('live');
    }

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.outcome === 'noop')).toBe(true);

    await cleanupMerchant(domain);
  });

  it('rejects mismatched Origin with 403 + rejected_origin row', async () => {
    const domain = 'mismatch.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');

    const res = await call(
      { merchantId, domain, userAgent: 'test' },
      { origin: 'https://evil.com' },
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('origin_mismatch');

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts[0]?.outcome).toBe('rejected_origin');

    await cleanupMerchant(domain);
  });

  it('rejects domain not in allowed_domains', async () => {
    const domain = 'allowlist.test';
    const otherDomain = 'other.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain, [domain]); // does NOT include otherDomain
    await flushRateLimits(merchantId, '127.0.0.1');

    const res = await call(
      { merchantId, domain: otherDomain, userAgent: 'test' },
      { origin: `https://${otherDomain}` },
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('domain_not_allowed');

    await cleanupMerchant(domain);
  });

  it('rate-limits at 11th call within window', async () => {
    const domain = 'ratelimit.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');

    // 10 successful (mostly noop after first since status flips to onboarding)
    for (let i = 0; i < 10; i++) {
      const res = await call(
        { merchantId, domain, userAgent: 'test' },
        { origin: `https://${domain}` },
      );
      expect(res.status).toBe(200);
    }
    const res = await call(
      { merchantId, domain, userAgent: 'test' },
      { origin: `https://${domain}` },
    );
    expect(res.status).toBe(429);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('rate_limited');

    await cleanupMerchant(domain);
  });

  it('returns 404 for unknown merchantId', async () => {
    const fake = 'SM-ZZZZZZ';
    await flushRateLimits(fake, '127.0.0.1');
    const res = await call(
      { merchantId: fake, domain: 'unknown.test', userAgent: 'test' },
      { origin: 'https://unknown.test' },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 on malformed body', async () => {
    const res = await call({ not: 'a valid body' }, { origin: 'https://x.test' });
    expect(res.status).toBe(400);
  });
});
