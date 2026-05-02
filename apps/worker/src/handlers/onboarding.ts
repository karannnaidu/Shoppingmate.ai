import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { catalogSync } from '../steps/catalogSync.js';
import { fingerprint } from '../steps/fingerprint.js';
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
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await fail(merchantId, 'fingerprint', err as Error);
    }
    throw err;
  }
  const platform = fp.platform;
  const adapterType = PLATFORM_TO_ADAPTER[platform];
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
    await emitMetric(merchantId, schema.metricNames.onboardingDetectedPlatformDegraded, {
      detected_platform: fp.detectedPlatform,
    });
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

  // Step 3 — CatalogSync
  await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncStarted);
  let catalog: Awaited<ReturnType<typeof catalogSync>>;
  try {
    catalog = await catalogSync({ merchantId, domain, platform, adapterType });
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
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: 'no_products',
      });
      await db
        .update(schema.merchants)
        .set({ status: 'degraded', lastError: 'selector_extract: no_products' })
        .where(eq(schema.merchants.id, merchantId));
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
  const smoke = await smokeTest({
    adapterType: adapterType === 'dom' ? 'dom' : adapterType === 'shopify' ? 'shopify' : 'woo',
    domain,
    firstVariantId,
    productUrl,
    selectors: selectors?.kind === 'ok' ? selectors.selectors : null,
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
}
