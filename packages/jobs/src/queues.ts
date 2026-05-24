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
