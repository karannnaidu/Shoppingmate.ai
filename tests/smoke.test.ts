import { db } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';
import { env, generateMerchantId, logger } from '@shoppingmate/shared';
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('env validates', () => {
    expect(env.DATABASE_URL).toMatch(/^postgres:\/\//);
    expect(env.REDIS_URL).toMatch(/^redis:\/\//);
  });

  it('logger is callable', () => {
    expect(typeof logger.info).toBe('function');
  });

  it('generateMerchantId emits SM- prefix', () => {
    expect(generateMerchantId()).toMatch(/^SM-[A-Z0-9]{6}$/);
  });

  it('db client constructed', () => {
    expect(db).toBeDefined();
  });

  it('onboardingQueue constructed', async () => {
    expect(onboardingQueue.name).toBe('onboarding');
    await onboardingQueue.close();
  });
});
