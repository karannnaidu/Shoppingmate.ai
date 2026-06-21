import { type OnboardingJobData, createRedisConnection, siteGraphCrawlQueue as crawlQueue, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { chat, logger } from '@shoppingmate/shared';
import { Queue, Worker } from 'bullmq';
import { onboardingHandler } from './handlers/onboarding.js';
import { ingestKbDoc } from './jobs/ingestKbDoc.js';
import { runCrawlSite } from './jobs/crawlSite.js';
import { runExtractSiteGraph } from './jobs/extractSiteGraph.js';
import { runDriftDetect } from './cron/driftDetect.js';
import { runPlaybookRefresh } from './cron/refreshPlaybooks.js';
import { downloadKbObject } from './r2-download.js';

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
  async (job) => runExtractSiteGraph({
    merchantId: job.data.merchantId as string,
    crawlId: job.data.crawlId as string,
    downloadObject: downloadKbObject,
  }),
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

// Nightly drift-detect cron: checks top-20 page ETags at 3am UTC and re-crawls if >3 changed.
const driftQueue = new Queue('site-graph-drift', { connection: createRedisConnection() });
await driftQueue.add('drift-detect', {}, { repeat: { pattern: '0 3 * * *' } });

const driftWorker = new Worker(
  'site-graph-drift',
  async () => {
    const merchants = await db.query.merchants.findMany({
      where: eq(schema.merchants.siteGraphEnabled, true),
    });
    for (const merchant of merchants) {
      try {
        const result = await runDriftDetect({ merchantId: merchant.id });
        logger.info({ merchantId: merchant.id, ...result }, 'drift-detect done');
      } catch (err) {
        logger.error({ merchantId: merchant.id, err: (err as Error).message }, 'drift-detect failed');
      }
    }
  },
  { connection: createRedisConnection(), concurrency: 1 },
);

driftWorker.on('ready', () => logger.info('site-graph-drift worker ready'));
driftWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'site-graph-drift completed'));
driftWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'site-graph-drift failed'));

// Nightly brand selling-playbook refresh cron: distils each merchant's last-90d
// conversation outcomes into a fresh selling playbook at 4am UTC.
const playbookChat = (messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) =>
  chat({
    model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6',
    messages,
    responseFormat: 'text',
    maxTokens: 700,
  });

const playbookQueue = new Queue('brand-playbook-refresh', { connection: createRedisConnection() });
await playbookQueue.add('refresh', {}, { repeat: { pattern: '0 4 * * *' } });

const playbookWorker = new Worker(
  'brand-playbook-refresh',
  async () => {
    const merchants = await db.query.merchants.findMany();
    for (const merchant of merchants) {
      try {
        const r = await runPlaybookRefresh({ merchantId: merchant.id, chat: playbookChat });
        logger.info({ merchantId: merchant.id, ...r }, 'playbook refresh done');
      } catch (err) {
        logger.error({ merchantId: merchant.id, err: (err as Error).message }, 'playbook refresh failed');
      }
    }
  },
  { connection: createRedisConnection(), concurrency: 1 },
);

playbookWorker.on('ready', () => logger.info('brand-playbook-refresh worker ready'));
playbookWorker.on('completed', (job) => logger.info({ jobId: job.id }, 'brand-playbook-refresh completed'));
playbookWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'brand-playbook-refresh failed'));

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await Promise.all([
    worker.close(),
    kbWorker.close(),
    siteGraphCrawlWorker.close(),
    siteGraphExtractWorker.close(),
    driftWorker.close(),
    driftQueue.close(),
    playbookWorker.close(),
    playbookQueue.close(),
  ]);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
