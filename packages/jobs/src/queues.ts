import { Queue } from 'bullmq';
import { createRedisConnection } from './connection.js';

export type OnboardingJobData = { merchantId: string; domain: string };

export const onboardingQueue = new Queue<OnboardingJobData>('onboarding', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export type SiteGraphCrawlJobData = { merchantId: string };
export const siteGraphCrawlQueue = new Queue<SiteGraphCrawlJobData>('site-graph-crawl', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

// Nav PRD Phase 2: (re)scan a merchant's page templates in a real browser.
// pageType omitted = all templates. trigger = why (onboarding|drift|verify|weekly|manual).
export type SiteTemplateScanJobData = { merchantId: string; pageType?: string; trigger?: string };
export const siteTemplateScanQueue = new Queue<SiteTemplateScanJobData>('site-template-scan', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 200 },
  },
});

/** extract = read a finished crawl; apply-exclusions = owner changed what to
 *  skip (fast: prune + refresh the assistant's site summary, no re-read). */
export type SiteGraphExtractJobData = { merchantId: string; crawlId?: string };

/** One website read per store at a time: the dashboard button, the nightly
 *  drift check, onboarding and Shopify webhooks all go through here. A read
 *  already queued or running absorbs the new request (2026-11-05: three clicks
 *  = three parallel reads that crashed into each other and emptied the
 *  knowledge base). */
export async function enqueueSiteCrawl(merchantId: string): Promise<{ queued: boolean }> {
  const jobId = `crawl-${merchantId}`;
  const existing = await siteGraphCrawlQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'waiting' || state === 'active' || state === 'delayed' || state === 'prioritized') {
      return { queued: false };
    }
    await existing.remove().catch(() => undefined);
  }
  await siteGraphCrawlQueue.add('crawl', { merchantId }, { jobId, removeOnComplete: true, removeOnFail: true });
  return { queued: true };
}

export const siteGraphExtractQueue = new Queue<SiteGraphExtractJobData>('site-graph-extract', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});
