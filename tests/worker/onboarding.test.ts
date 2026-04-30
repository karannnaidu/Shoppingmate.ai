import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { onboardingHandler } from '../../apps/worker/src/handlers/onboarding.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

const server = setupServer();
const ORIGINAL_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  if (ORIGINAL_API_KEY === undefined) {
    // biome-ignore lint/performance/noDelete: must truly unset env var to avoid leaking 'undefined' string into later tests
    delete process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  } else {
    process.env.GOOGLE_SAFE_BROWSING_API_KEY = ORIGINAL_API_KEY;
  }
});

async function provision(domain: string): Promise<string> {
  const id = generateMerchantId();
  await db.insert(schema.merchants).values({
    id,
    domain,
    allowedDomains: [domain],
    status: 'onboarding',
    lastInstallAt: new Date(),
  });
  return id;
}

async function cleanup(merchantId: string): Promise<void> {
  await db.delete(schema.metricEvents).where(eq(schema.metricEvents.merchantId, merchantId));
  await db.delete(schema.installAttempts).where(eq(schema.installAttempts.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
}

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

function fakeJob(merchantId: string, domain: string) {
  return {
    id: 'test-job',
    data: { merchantId, domain },
    attemptsMade: 0,
    opts: { attempts: 5 },
  } as unknown as Parameters<typeof onboardingHandler>[0];
}

describe('onboardingHandler', () => {
  beforeEach(() => {
    process.env.GOOGLE_SAFE_BROWSING_API_KEY = 'test-key';
  });

  it('happy path: safe + Shopify → status=live, platform=shopify', async () => {
    const domain = 'shopify-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(shopifyHtml)),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('shopify');
    expect(m?.adapterType).toBe('shopify');
    expect(m?.safetyCheckedAt).toBeInstanceOf(Date);
    expect(m?.lastFingerprintedAt).toBeInstanceOf(Date);

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.safety.cleared');
    expect(names).toContain('onboarding.fingerprint.shopify');
    expect(names).toContain('onboarding.completed');

    await cleanup(id);
  });

  it('safety flagged → status=rejected, no fingerprint', async () => {
    const domain = 'flagged.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () =>
        HttpResponse.json({ matches: [{ threatType: 'MALWARE' }] }),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('rejected');
    expect(m?.lastError).toContain('safety');
    expect(m?.platform).toBeNull();

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.safety.rejected');
    expect(names.find((n) => n.startsWith('onboarding.fingerprint'))).toBeUndefined();

    await cleanup(id);
  });

  it('custom site → platform=custom, adapter=dom', async () => {
    const domain = 'custom-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(customHtml)),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');

    await cleanup(id);
  });

  it('fingerprint fetch failure on final attempt → status=failed', async () => {
    const domain = 'flaky.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.error()),
    );

    const finalJob = {
      id: 'final',
      data: { merchantId: id, domain },
      attemptsMade: 4,
      opts: { attempts: 5 },
    } as unknown as Parameters<typeof onboardingHandler>[0];

    await expect(onboardingHandler(finalJob)).rejects.toThrow();

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('failed');
    expect(m?.lastError).toContain('fingerprint');

    await cleanup(id);
  });
});
