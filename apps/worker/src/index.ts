import {
  type OnboardingJobData,
  createRedisConnection,
  siteGraphCrawlQueue as crawlQueue,
  siteGraphExtractQueue,
  siteTemplateScanQueue,
} from '@shoppingmate/jobs';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { chat, logger } from '@shoppingmate/shared';
import { Queue, Worker } from 'bullmq';
import { onboardingHandler } from './handlers/onboarding.js';
import { ingestKbDoc } from './jobs/ingestKbDoc.js';
import { runCrawlSite } from './jobs/crawlSite.js';
import { runExtractSiteGraph } from './jobs/extractSiteGraph.js';
import { runNightlyQa } from './jobs/nightlyQa.js';
import { runScanSiteTemplates } from './jobs/scanSiteTemplates.js';
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

// Nav Phase 2: real-browser template scans — on demand (dashboard re-scan,
// drift/verify signals from live widgets) and a weekly safety-net re-scan.
const templateScanWorker = new Worker(
  'site-template-scan',
  async (job) => {
    if (job.name === 'weekly') {
      const merchants = await db.query.merchants.findMany({
        where: eq(schema.merchants.siteGraphEnabled, true),
      });
      for (const m of merchants) await siteTemplateScanQueue.add('scan', { merchantId: m.id, trigger: 'weekly' });
      return { enqueued: merchants.length };
    }
    return runScanSiteTemplates({
      merchantId: job.data.merchantId as string,
      pageType: job.data.pageType as string | undefined,
      trigger: job.data.trigger as string | undefined,
    });
  },
  { connection: createRedisConnection(), concurrency: 1 },
);
await siteTemplateScanQueue.add('weekly', { merchantId: '*' }, { repeat: { pattern: '0 2 * * 0' } });
templateScanWorker.on('ready', () => logger.info('site-template-scan worker ready'));
templateScanWorker.on('completed', (job, rv) =>
  logger.info({ jobId: job.id, result: rv }, 'site-template-scan completed'));
templateScanWorker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'site-template-scan failed'));

// Nav Phase 6: nightly synthetic QA (Chrome + Safari engines, desktop + mobile)
// per site-graph merchant; on demand via job name 'run' with {merchantId}.
const qaQueue = new Queue('nightly-qa', { connection: createRedisConnection() });
await qaQueue.add('nightly', {}, { repeat: { pattern: '30 1 * * *' } });
const qaWorker = new Worker(
  'nightly-qa',
  async (job) => {
    if (job.name === 'run') {
      return runNightlyQa({ merchantId: job.data.merchantId as string, combos: job.data.combos as string[] | undefined });
    }
    const merchants = await db.query.merchants.findMany({ where: eq(schema.merchants.siteGraphEnabled, true) });
    const summary: Array<{ merchantId: string; passed: number; total: number }> = [];
    for (const m of merchants) {
      try {
        const r = await runNightlyQa({ merchantId: m.id });
        summary.push({ merchantId: m.id, passed: r.passed, total: r.total });
      } catch (err) {
        logger.error({ merchantId: m.id, err: (err as Error).message }, 'nightly qa failed');
      }
    }
    return summary;
  },
  { connection: createRedisConnection(), concurrency: 1 },
);
qaWorker.on('ready', () => logger.info('nightly-qa worker ready'));
qaWorker.on('completed', (job, rv) =>
  logger.info({ jobId: job.id, result: Array.isArray(rv) ? rv : { passed: rv?.passed, total: rv?.total } }, 'nightly-qa completed'));
qaWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'nightly-qa failed'));

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
    templateScanWorker.close(),
    qaWorker.close(),
    qaQueue.close(),
  ]);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
