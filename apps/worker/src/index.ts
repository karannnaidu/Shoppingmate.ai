import { createRedisConnection, type OnboardingJobData } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { Worker } from 'bullmq';

const worker = new Worker<OnboardingJobData>(
  'onboarding',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'onboarding job received (stub)');
    return { stub: true };
  },
  { connection: createRedisConnection(), concurrency: 1 },
);

worker.on('ready', () => logger.info('worker ready'));
worker.on('failed', (job, err) =>
  logger.error({ jobId: job?.id, err: err.message }, 'job failed'),
);

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
