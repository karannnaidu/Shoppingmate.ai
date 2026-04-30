import type { Redis } from 'ioredis';

export async function isAllowed(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number,
): Promise<boolean> {
  const cutoff = nowMs - windowMs;
  const member = `${nowMs}-${Math.random()}`;

  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, cutoff);
  pipeline.zcard(key);
  const results = await pipeline.exec();

  if (!results) throw new Error('rate limiter pipeline failed');
  const count = results[1]?.[1] as number;

  if (count >= limit) return false;

  const writePipeline = redis.multi();
  writePipeline.zadd(key, nowMs, member);
  writePipeline.expire(key, Math.ceil(windowMs / 1000));
  await writePipeline.exec();
  return true;
}
