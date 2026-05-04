import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const kbQueue = new Queue('kb-ingest', { connection });

export async function enqueueKbIngest(documentId: string) {
  await kbQueue.add('ingest', { documentId }, { removeOnComplete: 100, removeOnFail: 500 });
}
