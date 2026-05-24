import { db as defaultDb, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { siteGraphCrawlQueue } from '@shoppingmate/jobs';

export type DriftDetectArgs = {
  merchantId: string;
  db?: typeof defaultDb;
  fetchFn?: typeof fetch;
  enqueueCrawl?: (args: { merchantId: string }) => Promise<void>;
};

export type DriftDetectResult = { recrawled: boolean; changedCount: number };

export async function runDriftDetect(args: DriftDetectArgs): Promise<DriftDetectResult> {
  const db = args.db ?? defaultDb;
  const fetchFn = args.fetchFn ?? fetch;
  const enqueueCrawl = args.enqueueCrawl ?? (async ({ merchantId }) => {
    await siteGraphCrawlQueue.add('crawl', { merchantId });
  });

  const pages = await db.query.sitePages.findMany({
    where: eq(schema.sitePages.merchantId, args.merchantId),
    limit: 20,
  });

  let changed = 0;
  for (const p of pages) {
    try {
      const res = await fetchFn(p.url, { method: 'HEAD' });
      const newEtag = (res.headers as Headers).get?.('etag') ?? '';
      const oldEtag = (p.meta as Record<string, unknown>).etag as string | undefined;
      if (oldEtag && newEtag && newEtag !== oldEtag) changed += 1;
    } catch { /* network blip — ignore */ }
  }

  if (changed > 3) {
    await enqueueCrawl({ merchantId: args.merchantId });
    return { recrawled: true, changedCount: changed };
  }
  return { recrawled: false, changedCount: changed };
}
