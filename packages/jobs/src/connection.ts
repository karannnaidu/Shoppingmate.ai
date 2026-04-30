import { env } from '@shoppingmate/shared';
import { Redis } from 'ioredis';

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
