import { randomUUID, createHash } from 'node:crypto';
import { db as defaultDb, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { uploadObject as defaultUpload, siteGraphKey } from '../r2-upload.js';
import { fetchSitemap } from '../steps/siteGraph/sitemap.js';

export type CrawlSiteArgs = {
  merchantId: string;
  db?: typeof defaultDb;
  uploadObject?: typeof defaultUpload;
  fetchFn?: typeof fetch;
  now?: () => Date;
  maxPages?: number;
};

export type CrawlSiteResult = {
  crawlId: string;
  status: 'ok' | 'failed';
  pageCount: number;
  error?: string;
};

export async function runCrawlSite(args: CrawlSiteArgs): Promise<CrawlSiteResult> {
  const db = args.db ?? defaultDb;
  const uploadObject = args.uploadObject ?? defaultUpload;
  const fetchFn = args.fetchFn ?? fetch;
  const now = args.now ?? (() => new Date());
  const maxPages = args.maxPages ?? 200;

  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, args.merchantId),
  });
  if (!merchant) {
    return { crawlId: '', status: 'failed', pageCount: 0, error: 'merchant not found' };
  }

  const crawlId = randomUUID();
  const startedAt = now();
  const rootUrl = `https://${merchant.domain}/`;
  await db.insert(schema.siteCrawls).values({
    id: crawlId,
    merchantId: args.merchantId,
    startedAt,
    status: 'running',
    rootUrl,
    pageCount: 0,
  });

  try {
    const urls = await fetchSitemap(rootUrl, fetchFn);
    const seedUrls = urls.length > 0 ? urls : [rootUrl];
    const toFetch = seedUrls.slice(0, maxPages);

    const sitemapKey = siteGraphKey(args.merchantId, crawlId, 'sitemap.xml');
    await uploadObject(sitemapKey, toFetch.join('\n'), 'text/plain');

    let pageCount = 0;
    for (const url of toFetch) {
      const res = await fetchFn(url);
      if (!res.ok) continue;
      const body = Buffer.from(await res.arrayBuffer());
      const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16);
      const contentType = res.headers.get('content-type') ?? 'text/html';
      const storageKey = siteGraphKey(args.merchantId, crawlId, `pages/${urlHash}.html`);
      await uploadObject(storageKey, body, contentType);
      await db.insert(schema.crawlArtifacts).values({
        id: randomUUID(),
        crawlId,
        url,
        urlHash,
        contentType,
        storageKey,
        byteSize: body.byteLength,
        httpStatus: res.status,
        fetchedAt: now(),
      });
      pageCount += 1;
    }

    await db.update(schema.siteCrawls)
      .set({ status: 'ok', pageCount, finishedAt: now() })
      .where(eq(schema.siteCrawls.id, crawlId));
    return { crawlId, status: 'ok', pageCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(schema.siteCrawls)
      .set({ status: 'failed', errorSummary: msg, finishedAt: now() })
      .where(eq(schema.siteCrawls.id, crawlId));
    return { crawlId, status: 'failed', pageCount: 0, error: msg };
  }
}
