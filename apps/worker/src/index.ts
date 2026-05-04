import { type OnboardingJobData, createRedisConnection } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { Worker } from 'bullmq';
import { onboardingHandler } from './handlers/onboarding.js';
import { ingestKbDoc } from './jobs/ingestKbDoc.js';

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

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await Promise.all([worker.close(), kbWorker.close()]);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
