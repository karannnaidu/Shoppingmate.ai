import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { Queue } = require('../../../node_modules/.pnpm/bullmq@5.76.4/node_modules/bullmq/dist/cjs/index.js');
const IORedis = require('../../../node_modules/.pnpm/ioredis@5.10.1/node_modules/ioredis/built/index.js');

const merchantId = process.argv[2] ?? 'SM-XPK2EN';
const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL not set');

const connection = new IORedis(url, { maxRetriesPerRequest: null });
const queue = new Queue('site-graph-crawl', { connection });

const job = await queue.add('crawl', { merchantId });
console.log('ENQUEUED', { id: job.id, name: job.name, merchantId, queue: 'site-graph-crawl' });

await queue.close();
await connection.quit();
