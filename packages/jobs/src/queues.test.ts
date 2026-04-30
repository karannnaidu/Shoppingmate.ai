import { afterAll, describe, expect, it } from 'vitest';
import { onboardingQueue } from './queues.js';

describe('onboardingQueue', () => {
  afterAll(async () => {
    await onboardingQueue.obliterate({ force: true });
    await onboardingQueue.close();
  });

  it('accepts a job and exposes it via getJob', async () => {
    const job = await onboardingQueue.add('test', {
      merchantId: 'SM-TEST01',
      domain: 'example.com',
    });
    const fetched = await onboardingQueue.getJob(job.id ?? '');
    expect(fetched?.data.merchantId).toBe('SM-TEST01');
  });
});
