import { env } from '@shoppingmate/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { isAllowed } from '../../apps/api/src/lib/rateLimiter.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

describe('isAllowed', () => {
  beforeEach(async () => {
    await redis.del('test:rl:k1');
  });

  afterAll(async () => {
    await redis.del('test:rl:k1');
    await redis.quit();
  });

  it('allows up to limit within window', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const ok = await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + i);
      expect(ok).toBe(true);
    }
  });

  it('denies once limit reached in window', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + i);
    const denied = await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + 5);
    expect(denied).toBe(false);
  });

  it('allows again after window slides past old entries', async () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + i);
    expect(await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + 5)).toBe(false);
    expect(await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + 1_500)).toBe(true);
  });
});
