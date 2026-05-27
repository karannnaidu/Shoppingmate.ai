import { Queue } from '../../../node_modules/.pnpm/bullmq@5.76.4/node_modules/bullmq/dist/cjs/index.js';
import IORedis from '../../../node_modules/.pnpm/ioredis@5.10.1/node_modules/ioredis/built/index.js';

const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL not set');

const connection = new IORedis(url, { maxRetriesPerRequest: null });

for (const name of ['site-graph-crawl', 'site-graph-extract', 'site-graph-drift', 'onboarding']) {
  const q = new Queue(name, { connection });
  const counts = await q.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused');
  console.log(name.padEnd(20), counts);
  const failed = await q.getJobs(['failed'], 0, 5);
  for (const j of failed) {
    console.log('  FAILED job:', j.id, j.name, 'err:', j.failedReason?.slice(0, 200));
  }
  const waiting = await q.getJobs(['wait'], 0, 5);
  for (const j of waiting) {
    console.log('  WAITING job:', j.id, j.name, 'data:', JSON.stringify(j.data));
  }
  await q.close();
}

await connection.quit();
