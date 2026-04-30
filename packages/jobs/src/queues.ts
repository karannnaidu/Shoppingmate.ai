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
