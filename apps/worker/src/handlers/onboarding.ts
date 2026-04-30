import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { fingerprint } from '../steps/fingerprint.js';
import { safetyCheck } from '../steps/safetyCheck.js';

const log = childLogger({ handler: 'onboarding' });

const PLATFORM_TO_ADAPTER: Record<string, schema.AdapterType> = {
  shopify: 'shopify',
  woocommerce: 'woo',
  custom: 'dom',
};

async function emitMetric(merchantId: string, metricName: string): Promise<void> {
  await db.insert(schema.metricEvents).values({ merchantId, metricName });
}

async function fail(merchantId: string, step: string, err: Error): Promise<void> {
  await db
    .update(schema.merchants)
    .set({ status: 'failed', lastError: `${step}: ${err.message}` })
    .where(eq(schema.merchants.id, merchantId));
  await db.insert(schema.metricEvents).values({
    merchantId,
    metricName: schema.metricNames.onboardingFailed,
    tags: { step },
  });
}

export async function onboardingHandler(
  job: Job<{ merchantId: string; domain: string }>,
): Promise<void> {
  const { merchantId, domain } = job.data;
  const start = Date.now();
  log.info({ jobId: job.id, merchantId, domain }, 'onboarding job started');

  // Step 1 — SafetyCheck
  let safety: Awaited<ReturnType<typeof safetyCheck>>;
  try {
    safety = await safetyCheck(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyError);
    log.error({ merchantId, err: (err as Error).message }, 'safety check error');
    throw err; // BullMQ will retry
  }

  if (safety.kind === 'flagged') {
    await db
      .update(schema.merchants)
      .set({ status: 'rejected', lastError: `safety: ${safety.threatType}` })
      .where(eq(schema.merchants.id, merchantId));
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyRejected);
    log.warn({ merchantId, threatType: safety.threatType }, 'merchant rejected by safety check');
    return; // terminal — do not retry, do not fingerprint
  }

  await db
    .update(schema.merchants)
    .set({ safetyCheckedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingSafetyCleared);

  // Step 2 — Fingerprint
  let platform: schema.PlatformValue;
  try {
    platform = await fingerprint(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingFingerprintFetchFailed);
    log.error({ merchantId, err: (err as Error).message }, 'fingerprint fetch failed');
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await fail(merchantId, 'fingerprint', err as Error);
    }
    throw err; // BullMQ retries until exhausted
  }

  const platformMetric =
    platform === 'shopify'
      ? schema.metricNames.onboardingFingerprintShopify
      : platform === 'woocommerce'
        ? schema.metricNames.onboardingFingerprintWoocommerce
        : schema.metricNames.onboardingFingerprintCustom;
  await emitMetric(merchantId, platformMetric);

  // Step 3 — Finalize
  const adapterType = PLATFORM_TO_ADAPTER[platform];
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      platform,
      adapterType,
      lastFingerprintedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));

  await db.insert(schema.metricEvents).values({
    merchantId,
    metricName: schema.metricNames.onboardingCompleted,
    tags: { platform, durationMs: Date.now() - start },
  });
  log.info({ merchantId, platform, durationMs: Date.now() - start }, 'onboarding complete');
}
