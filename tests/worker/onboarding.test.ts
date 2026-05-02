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
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');

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

  it('happy path: safe + Shopify → status=live, products synced, smoke passed', async () => {
    const domain = 'shopify-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(shopifyHtml)),
      http.get(`https://${domain}/products.json`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        if (page === '1') {
          return HttpResponse.json({
            products: [
              {
                id: 100,
                title: 'Test',
                body_html: '<p>desc</p>',
                handle: 'test-product',
                image: { src: 'https://x' },
                variants: [{ id: 1001, sku: 'T', price: '10.00', available: true, option1: 'M' }],
              },
            ],
          });
        }
        return HttpResponse.json({ products: [] });
      }),
      http.post(`https://${domain}/cart/add.js`, () => HttpResponse.json({ id: 1001, key: 'tok' })),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('shopify');
    expect(m?.adapterType).toBe('shopify');
    expect(m?.smokePassedAt).toBeInstanceOf(Date);
    expect(m?.catalogSyncedAt).toBeInstanceOf(Date);

    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.merchantId, id));
    expect(products).toHaveLength(1);

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.catalog_sync.completed');
    expect(names).toContain('onboarding.smoke.passed');
    expect(names).toContain('onboarding.completed');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
    await cleanup(id);
  });

  it('happy path: safe + Woo → status=live, products synced, smoke passed', async () => {
    const domain = 'woo-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(wooHtml)),
      http.get(`https://${domain}/wp-json/wc/store/v1/products`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        if (page === 1) {
          return HttpResponse.json([
            {
              id: 200,
              name: 'Mug',
              slug: 'mug',
              permalink: `https://${domain}/product/mug/`,
              description: 'mug',
              images: [],
              prices: { price: '1500', currency_code: 'USD', currency_minor_unit: 2 },
              is_in_stock: true,
              variations: [],
            },
          ]);
        }
        return HttpResponse.json([]);
      }),
      http.post(`https://${domain}/wp-json/wc/store/v1/cart/add-item`, () =>
        HttpResponse.json({ items: [{ id: 200 }] }),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('woocommerce');
    expect(m?.adapterType).toBe('woo');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
    await cleanup(id);
  });

  it('magento detected → status=degraded (no smoke yet), detected_platform tagged', async () => {
    const domain = 'magento-detect.test';
    const magentoHtml = readFileSync(resolve(fixturesDir, 'magentoHomepage.html'), 'utf8');
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(magentoHtml)),
      // Empty sitemap → catalog yields 0 products → no_products → degraded.
      http.get(`https://${domain}/sitemap.xml`, () =>
        HttpResponse.text(
          '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        ),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');
    expect((m?.adapterConfig as Record<string, unknown>)?.detectedPlatform).toBe('magento');

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.fingerprint.magento_detected');
    expect(names).toContain('onboarding.detected_platform.degraded');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
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

  it('custom site (no detection) → adapter=dom, no products → degraded', async () => {
    const domain = 'custom-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(customHtml)),
      http.get(`https://${domain}/sitemap.xml`, () =>
        HttpResponse.text(
          '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        ),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');
    expect(['degraded', 'failed']).toContain(m?.status);

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
