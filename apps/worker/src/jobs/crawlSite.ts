import { randomUUID, createHash } from 'node:crypto';
import { db as defaultDb, schema, type CrawlStats } from '@shoppingmate/db';
import { isPathExcluded, pageKey } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { uploadObject as defaultUpload, siteGraphKey } from '../r2-upload.js';
import { fetchSitemap, priorityPages, sameSiteLinks } from '../steps/siteGraph/sitemap.js';

// Identify ourselves honestly (same as onboarding). Requests with no UA at all
// are blocked by many hosts — Shake Shack's crawl returned 0 pages.
const CRAWLER_UA = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.shop/bot)';

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

  const uaFetch = ((u: string, init?: RequestInit) =>
    fetchFn(u, { ...init, headers: { 'user-agent': CRAWLER_UA, ...(init?.headers ?? {}) } })) as typeof fetch;
  try {
    let urls = await fetchSitemap(rootUrl, uaFetch);
    // No sitemap (common for small service businesses): follow the home
    // page's own links instead, so menu / services / contact are still read.
    if (urls.length === 0) {
      try {
        const home = await uaFetch(rootUrl);
        if (home.ok) urls = sameSiteLinks(await home.text(), rootUrl);
      } catch {
        /* keep the priority seeds only */
      }
    }
    // Policy / FAQ / contact pages first (never in Shopify sitemaps), then the
    // sitemap's pages; the cap applies after, so they can't be crowded out.
    const seedUrls = [...priorityPages(rootUrl), ...urls];
    // One fetch per page: /about and /about/ are the same page (Calmosis's
    // crawl read both, wasting the page budget and doubling the site map).
    const discovered: string[] = [];
    const duplicates: string[] = [];
    const seenKeys = new Set<string>();
    for (const u of seedUrls) {
      const key = pageKey(u);
      if (seenKeys.has(key)) {
        if (!discovered.includes(u)) duplicates.push(u);
        continue;
      }
      seenKeys.add(key);
      discovered.push(u);
    }
    // Pages the owner told the assistant to skip are not fetched at all, so
    // they don't eat the page budget either.
    const excludedPaths = (merchant.kbExcludedPaths ?? []) as string[];
    const excluded = discovered.filter((u) => isPathExcluded(u, excludedPaths));
    const toFetch = discovered.filter((u) => !isPathExcluded(u, excludedPaths)).slice(0, maxPages);

    // "Soft 404": many sites (SPAs, Calmosis) answer ANY path with 200 and the
    // same not-found shell. Fetch one surely-missing URL and skip every page
    // that's byte-identical to it — otherwise /menu, /book, /pages/faq… all
    // land in the knowledge base as copies of the home page.
    let notFoundHash: string | null = null;
    try {
      const probe = await uaFetch(`${new URL(rootUrl).origin}/__shoppingmate-not-a-page-${randomUUID().slice(0, 8)}`);
      if (probe.ok) notFoundHash = createHash('sha256').update(Buffer.from(await probe.arrayBuffer())).digest('hex');
    } catch {
      /* no probe — keep everything */
    }
    const notFound: string[] = [];

    const sitemapKey = siteGraphKey(args.merchantId, crawlId, 'sitemap.xml');
    await uploadObject(sitemapKey, toFetch.join('\n'), 'text/plain');

    let pageCount = 0;
    for (const url of toFetch) {
      // One unreachable page (DNS hiccup, reset) must not fail the whole
      // crawl — it did for a 1,000-product beauty store.
      let res: Response;
      let body: Buffer;
      try {
        res = await fetchFn(url, { headers: { 'user-agent': CRAWLER_UA, accept: 'text/html,*/*' } });
        if (!res.ok) continue;
        body = Buffer.from(await res.arrayBuffer());
      } catch {
        continue;
      }
      if (notFoundHash && createHash('sha256').update(body).digest('hex') === notFoundHash) {
        notFound.push(url);
        continue;
      }
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

    // Fetched, not yet read: the extract job flips this to ok/failed. The
    // dashboard used to say "Up to date" here even when every read crashed.
    const stats: CrawlStats = { discovered, excluded, notFound, duplicates };
    await db.update(schema.siteCrawls)
      .set({ status: 'extracting', pageCount, stats })
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
