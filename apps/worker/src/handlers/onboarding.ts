import { implementedAdapters } from '@shoppingmate/adapters';
import { siteGraphCrawlQueue } from '@shoppingmate/jobs';
import { db, schema } from '@shoppingmate/db';
import { childLogger, decryptSecret } from '@shoppingmate/shared';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { catalogSync } from '../steps/catalogSync.js';
import { shopifyFinalizeOutcome } from '../steps/shopifyFinalizeOutcome.js';
import { fingerprint } from '../steps/fingerprint.js';
import { syncMerchantBrand } from '../steps/syncMerchantBrand.js';
import { safetyCheck } from '../steps/safetyCheck.js';
import { selectorExtract } from '../steps/selectorExtract.js';
import { smokeTest } from '../steps/smokeTest.js';

const log = childLogger({ handler: 'onboarding' });

const PLATFORM_TO_ADAPTER: Record<schema.PlatformValue, schema.AdapterType> = {
  shopify: 'shopify',
  woocommerce: 'woo',
  custom: 'dom',
};

async function emitMetric(
  merchantId: string,
  metricName: string,
  tags?: Record<string, string | number | boolean>,
): Promise<void> {
  await db.insert(schema.metricEvents).values({ merchantId, metricName, tags });
}

/** Read the brand's own pages (policies, FAQ, about, contact) right after
 *  onboarding. Previously this only happened via the Shopify-app webhook or
 *  the dashboard "Re-read my pages" button, so a script-tag brand's assistant
 *  couldn't answer "what's your return policy?". Best-effort, never blocks. */
async function queueSiteCrawl(merchantId: string): Promise<void> {
  try {
    await siteGraphCrawlQueue.add('crawl', { merchantId });
    log.info({ merchantId }, 'onboarding: site crawl queued');
  } catch (err) {
    log.warn({ merchantId, err: (err as Error).message }, 'onboarding: could not queue site crawl');
  }
}

/** Finish onboarding for a site with no product catalog (restaurants, salons,
 *  clinics, agencies…): brand profile from its pages, live, pages crawled.
 *  The assistant answers from the site and captures bookings/enquiries. */
async function finishServiceSite(
  merchantId: string,
  domain: string,
  adapterConfig: Record<string, unknown>,
  start: number,
  opts: { profileDone?: boolean } = {},
): Promise<void> {
  if (!opts.profileDone) {
    const [row] = await db
      .select({ name: schema.merchants.name })
      .from(schema.merchants)
      .where(eq(schema.merchants.id, merchantId))
      .limit(1);
    await syncMerchantBrand({ merchantId, domain, brandName: row?.name ?? domain });
  }
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      adapterConfig: { ...adapterConfig, catalog: 'none', transactionalDisabled: true },
      lastIndexedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingCompleted, {
    platform: 'custom',
    durationMs: Date.now() - start,
    catalog: 'none',
  });
  log.info({ merchantId, domain }, 'onboarding complete (service / info site — no product catalog)');
  await queueSiteCrawl(merchantId);
}

async function fail(merchantId: string, step: string, err: Error): Promise<void> {
  await db
    .update(schema.merchants)
    .set({ status: 'failed', lastError: `${step}: ${err.message}` })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingFailed, { step });
}

export async function onboardingHandler(
  job: Job<{ merchantId: string; domain: string }>,
): Promise<void> {
  const { merchantId, domain } = job.data;
  const start = Date.now();
  log.info({ jobId: job.id, merchantId, domain }, 'onboarding job started');

  // Step 1 — SafetyCheck (unchanged)
  let safety: Awaited<ReturnType<typeof safetyCheck>>;
  try {
    safety = await safetyCheck(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyError);
    log.error({ merchantId, err: (err as Error).message }, 'safety check error');
    throw err;
  }
  if (safety.kind === 'flagged') {
    await db
      .update(schema.merchants)
      .set({ status: 'rejected', lastError: `safety: ${safety.threatType}` })
      .where(eq(schema.merchants.id, merchantId));
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyRejected);
    return;
  }
  await db
    .update(schema.merchants)
    .set({ safetyCheckedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingSafetyCleared);

  // Step 2 — Fingerprint
  let fp: Awaited<ReturnType<typeof fingerprint>>;
  try {
    fp = await fingerprint(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingFingerprintFetchFailed);
    // The site's bot protection refused our reader (Cloudflare etc.). The
    // assistant itself runs in shoppers' browsers and still works, so go live
    // and tell the owner how to let us read their pages — instead of marking
    // the whole store failed (segment audit: a dental clinic chain).
    const blocked = /\b(401|403|429|503)\b/.exec((err as Error).message);
    if (blocked) {
      await db
        .update(schema.merchants)
        .set({
          platform: 'custom',
          adapterType: 'dom',
          adapterConfig: { catalog: 'none', transactionalDisabled: true },
          status: 'live',
          lastError: `site_blocks_reader: ${blocked[1]}`,
        })
        .where(eq(schema.merchants.id, merchantId));
      log.warn({ merchantId, domain, status: blocked[1] }, 'onboarding: site blocks our reader — live without page reading');
      return;
    }
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await fail(merchantId, 'fingerprint', err as Error);
    }
    throw err;
  }
  const platform = fp.platform;
  const baseAdapter = PLATFORM_TO_ADAPTER[platform];
  const detected = fp.detectedPlatform;
  const adapterType: schema.AdapterType =
    detected && implementedAdapters.has(detected as schema.AdapterType)
      ? (detected as schema.AdapterType)
      : baseAdapter;
  const platformMetric =
    platform === 'shopify'
      ? schema.metricNames.onboardingFingerprintShopify
      : platform === 'woocommerce'
        ? schema.metricNames.onboardingFingerprintWoocommerce
        : schema.metricNames.onboardingFingerprintCustom;
  await emitMetric(merchantId, platformMetric);

  const adapterConfig: Record<string, unknown> = {};
  if (fp.detectedPlatform) {
    adapterConfig.detectedPlatform = fp.detectedPlatform;
    const detectedKey = `onboardingFingerprint${
      fp.detectedPlatform.charAt(0).toUpperCase() + fp.detectedPlatform.slice(1)
    }Detected` as keyof typeof schema.metricNames;
    await emitMetric(merchantId, schema.metricNames[detectedKey]);
    // Only emit degraded metric when we cannot promote to a real adapter.
    if (!implementedAdapters.has(fp.detectedPlatform as schema.AdapterType)) {
      await emitMetric(merchantId, schema.metricNames.onboardingDetectedPlatformDegraded, {
        detected_platform: fp.detectedPlatform,
      });
    }
  }
  await db
    .update(schema.merchants)
    .set({
      platform,
      adapterType,
      adapterConfig,
      lastFingerprintedAt: new Date(),
      status: 'onboarding',
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));

  // Step 3 — CatalogSync. Load the merchant's Shopify Admin token (if any) so
  // catalog sync can use the Admin API on locked/dev stores where public
  // /products.json is blocked.
  await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncStarted);
  let shopifyToken: string | undefined;
  {
    const [tokenRow] = await db
      .select({ enc: schema.merchants.shopifyAdminTokenEnc })
      .from(schema.merchants)
      .where(eq(schema.merchants.id, merchantId))
      .limit(1);
    if (tokenRow?.enc) {
      try {
        shopifyToken = decryptSecret(tokenRow.enc);
      } catch (err) {
        log.warn({ merchantId, err: (err as Error).message }, 'failed to decrypt shopify token');
      }
    }
  }
  let catalog: Awaited<ReturnType<typeof catalogSync>>;
  try {
    catalog = await catalogSync({ merchantId, domain, platform, adapterType, shopifyToken });
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncFailed, {
      reason: 'exception',
    });
    await fail(merchantId, 'catalogSync', err as Error);
    throw err;
  }
  if (catalog.kind === 'failed') {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncFailed, {
      source: catalog.source,
      reason: catalog.reason,
    });
    // A custom website with no catalog is usually a SERVICE business
    // (restaurant, salon, clinic, agency) — not a broken store. Finish it as a
    // booking/info site instead of marking onboarding failed.
    if (platform === 'custom' && /no_sitemap|no_products/.test(catalog.reason)) {
      await finishServiceSite(merchantId, domain, adapterConfig, start);
      return;
    }
    await fail(merchantId, 'catalogSync', new Error(catalog.reason));
    return;
  }
  if (catalog.kind === 'partial') {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncDegraded, {
      products_count: catalog.productsCount,
      expected: catalog.expected,
      source: catalog.source,
      reason: catalog.reason,
    });
  } else {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncCompleted, {
      products_count: catalog.productsCount,
      source: catalog.source,
    });
  }

  // Step 3.5 — Brand profile (best-effort; generates brand_summary +
  // brand_categories from the store's own pages so the bot works on ANY store
  // without manual setup). Never blocks onboarding — syncMerchantBrand swallows
  // its own failures.
  {
    const [brandMerchant] = await db
      .select({ name: schema.merchants.name })
      .from(schema.merchants)
      .where(eq(schema.merchants.id, merchantId))
      .limit(1);
    await syncMerchantBrand({ merchantId, domain, brandName: brandMerchant?.name ?? domain });
  }

  // Step 4 — SelectorExtract (DOM merchants only)
  let selectors: Awaited<ReturnType<typeof selectorExtract>> | null = null;
  if (adapterType === 'dom') {
    await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractStarted);
    const [firstProduct] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.merchantId, merchantId))
      .limit(1);
    if (!firstProduct) {
      // No product pages: a service / info site (see finishServiceSite). It was
      // previously marked 'degraded' and never had its pages read.
      await finishServiceSite(merchantId, domain, adapterConfig, start, { profileDone: true });
      return;
    }
    try {
      selectors = await selectorExtract({
        merchantId,
        domain,
        sampleProductUrl: firstProduct.productUrl,
        cartUrl: `https://${domain}/cart`,
        checkoutUrl: `https://${domain}/checkout`,
      });
    } catch (err) {
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: 'exception',
      });
      await fail(merchantId, 'selectorExtract', err as Error);
      throw err;
    }
    if (selectors.kind === 'failed') {
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: selectors.reason,
      });
      await db
        .update(schema.merchants)
        .set({ status: 'degraded', lastError: `selector_extract: ${selectors.reason}` })
        .where(eq(schema.merchants.id, merchantId));
      return;
    }
    await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractCompleted, {
      llm_input_tokens: selectors.llmInputTokens,
      llm_output_tokens: selectors.llmOutputTokens,
    });
    await db
      .update(schema.merchants)
      .set({
        adapterConfig: {
          ...adapterConfig,
          selectors: selectors.selectors,
          page_templates: selectors.pageTemplates,
        },
      })
      .where(eq(schema.merchants.id, merchantId));
  }

  // Shopify (storefront-bridge) carts are driven CLIENT-SIDE by the widget's
  // Cart AJAX, so a server-side cart smoke can't validate them — a 422 here is a
  // false negative that would wrongly mark the store 'degraded'. Catalog sync +
  // the widget's own install ping are the real signals, so finalize as live and
  // skip the server smoke.
  if (platform === 'shopify') {
    // If /products.json was blocked we fell back to a DOM crawl with no variant
    // ids — cart.add can't resolve a numeric variant, so disable transactional
    // and mark the store degraded rather than presenting it as fully live.
    const outcome = shopifyFinalizeOutcome(catalog.source);
    await db
      .update(schema.merchants)
      .set({
        status: outcome.status,
        adapterConfig: { ...adapterConfig, transactionalDisabled: outcome.transactionalDisabled },
        smokePassedAt: outcome.status === 'live' ? new Date() : null,
        lastIndexedAt: new Date(),
        lastError: outcome.lastError,
      })
      .where(eq(schema.merchants.id, merchantId));
    await emitMetric(merchantId, schema.metricNames.onboardingCompleted, {
      platform,
      durationMs: Date.now() - start,
      transactional: !outcome.transactionalDisabled,
    });
    log.info(
      { merchantId, platform, status: outcome.status, catalogSource: catalog.source },
      'onboarding complete (shopify — server cart smoke skipped, client-side bridge)',
    );
    await queueSiteCrawl(merchantId);
    return;
  }

  // Step 5 — SmokeTest
  await emitMetric(merchantId, schema.metricNames.onboardingSmokeStarted);
  const [firstProductForSmoke] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.merchantId, merchantId))
    .limit(1);
  const firstVariantId =
    (firstProductForSmoke?.variants as Array<{ id: string }> | null)?.[0]?.id ??
    firstProductForSmoke?.sku ??
    'unknown';
  const productUrl = firstProductForSmoke?.productUrl ?? `https://${domain}/`;
  const [merchantRow] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  const smoke = await smokeTest({
    adapterType: adapterType === 'suggest' ? 'dom' : adapterType,
    domain,
    firstVariantId,
    productUrl,
    selectors: selectors?.kind === 'ok' ? selectors.selectors : null,
    merchant: merchantRow,
    sku: firstProductForSmoke?.sku,
  });

  if (smoke.kind === 'failed') {
    await emitMetric(merchantId, schema.metricNames.onboardingSmokeFailed, {
      adapter_type: adapterType,
      reason: smoke.reason,
    });
    await db
      .update(schema.merchants)
      .set({ status: 'degraded', lastError: `smoke: ${smoke.reason}` })
      .where(eq(schema.merchants.id, merchantId));
    // A failed cart smoke only means add-to-cart is unverified — the assistant
    // still answers, so it must still learn the site (services, policies,
    // FAQs). Before, a degraded store never had its pages read at all.
    await queueSiteCrawl(merchantId);
    return;
  }

  await emitMetric(merchantId, schema.metricNames.onboardingSmokePassed, {
    adapter_type: adapterType,
    latency_ms: smoke.latencyMs,
  });

  // Step 6 — Finalize
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      smokePassedAt: new Date(),
      lastIndexedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingCompleted, {
    platform,
    durationMs: Date.now() - start,
  });
  log.info({ merchantId, platform, durationMs: Date.now() - start }, 'onboarding complete');
  await queueSiteCrawl(merchantId);
}
