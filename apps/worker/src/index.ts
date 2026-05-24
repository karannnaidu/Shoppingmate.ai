import { type OnboardingJobData, createRedisConnection, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { Worker } from 'bullmq';
import { onboardingHandler } from './handlers/onboarding.js';
import { ingestKbDoc } from './jobs/ingestKbDoc.js';
import { runCrawlSite } from './jobs/crawlSite.js';
import { runExtractSiteGraph } from './jobs/extractSiteGraph.js';

const worker = new Worker<OnboardingJobData>(
  'onboarding',
  async (job) => {
    await onboardingHandler(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 4,
  },
);

worker.on('ready', () => logger.info('worker ready'));
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'job failed'));

const kbWorker = new Worker(
  'kb-ingest',
  async (job) => {
    if (job.name === 'ingest') {
      return ingestKbDoc({ documentId: job.data.documentId as string });
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 2,
  },
);

kbWorker.on('ready', () => logger.info('kb-ingest worker ready'));
kbWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'kb-ingest completed'));
kbWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'kb-ingest failed'));

const siteGraphCrawlWorker = new Worker(
  'site-graph-crawl',
  async (job) => {
    const out = await runCrawlSite({ merchantId: job.data.merchantId as string });
    if (out.status === 'ok') {
      await siteGraphExtractQueue.add('extract', { merchantId: job.data.merchantId as string, crawlId: out.crawlId });
    }
    return out;
  },
  { connection: createRedisConnection(), concurrency: 2 },
);

const siteGraphExtractWorker = new Worker(
  'site-graph-extract',
  async (job) => runExtractSiteGraph({ merchantId: job.data.merchantId as string, crawlId: job.data.crawlId as string }),
  { connection: createRedisConnection(), concurrency: 2 },
);

siteGraphCrawlWorker.on('ready', () => logger.info('site-graph-crawl worker ready'));
siteGraphCrawlWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'site-graph-crawl completed'));
siteGraphCrawlWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'site-graph-crawl failed'));

siteGraphExtractWorker.on('ready', () => logger.info('site-graph-extract worker ready'));
siteGraphExtractWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'site-graph-extract completed'));
siteGraphExtractWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'site-graph-extract failed'));

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await Promise.all([
    worker.close(),
    kbWorker.close(),
    siteGraphCrawlWorker.close(),
    siteGraphExtractWorker.close(),
  ]);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
