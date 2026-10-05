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

export type SiteGraphExtractJobData = { merchantId: string; crawlId: string };
export const siteGraphExtractQueue = new Queue<SiteGraphExtractJobData>('site-graph-extract', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});
