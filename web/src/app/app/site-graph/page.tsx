import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { siteCrawls, sitePages, merchants, siteTemplates, crawlArtifacts, products } from '@shoppingmate/db/schema';
import type { CrawlStats } from '@shoppingmate/db/schema';
import { and, eq, desc, asc } from 'drizzle-orm';
import { pageKey } from '@shoppingmate/shared/sitemap';
import { SiteTemplatesCard } from '@/components/site-templates-card';
import { WebsiteSitemap, type PageStatus, type SitemapEntry } from '@/components/website-sitemap';
import { Button } from '@/components/ui/button';
import { DashHeader } from '@/components/dashboard/v2';

export const dynamic = 'force-dynamic';

export default async function SiteGraphPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  const sp = (await searchParams) ?? {};
  const merchantId = session.merchant.id;

  const templates = await db
    .select({
      pageType: siteTemplates.pageType,
      status: siteTemplates.status,
      scannedAt: siteTemplates.scannedAt,
      scanTrigger: siteTemplates.scanTrigger,
      recipes: siteTemplates.recipes,
      sampleUrls: siteTemplates.sampleUrls,
    })
    .from(siteTemplates)
    .where(eq(siteTemplates.merchantId, merchantId))
    .orderBy(asc(siteTemplates.pageType));

  const recentCrawls = await db
    .select({
      id: siteCrawls.id,
      startedAt: siteCrawls.startedAt,
      finishedAt: siteCrawls.finishedAt,
      status: siteCrawls.status,
      pageCount: siteCrawls.pageCount,
      errorSummary: siteCrawls.errorSummary,
      stats: siteCrawls.stats,
    })
    .from(siteCrawls)
    .where(eq(siteCrawls.merchantId, merchantId))
    .orderBy(desc(siteCrawls.startedAt))
    .limit(5);
  const latestCrawl = recentCrawls[0];
  const lastGood = recentCrawls.find((c) => c.status === 'ok');
  const inFlight = latestCrawl && ['pending', 'running', 'extracting'].includes(latestCrawl.status);

  const pages = await db
    .select({ url: sitePages.url })
    .from(sitePages)
    .where(eq(sitePages.merchantId, merchantId));
  const learnedKeys = new Set(pages.map((p) => pageKey(p.url)));

  const catalog = await db
    .select({ productUrl: products.productUrl })
    .from(products)
    // Only products read from the site: a hand-added one (Bliss Club) points at
    // the home page and would badge it as a product.
    .where(and(eq(products.merchantId, merchantId), eq(products.source, 'site_graph')));
  const catalogKeys = new Set(catalog.map((p) => (p.productUrl ? pageKey(p.productUrl) : '')).filter(Boolean));

  const [merchantRow] = await db
    .select({ siteGraphVersion: merchants.siteGraphVersion, kbExcludedPaths: merchants.kbExcludedPaths })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  const excluded = (merchantRow?.kbExcludedPaths ?? []) as string[];

  // Every page we know of: what the latest read found (before skips), what it
  // fetched, and what's already learned.
  const stats = (latestCrawl?.stats ?? {}) as CrawlStats;
  let fetched: string[] = [];
  if (latestCrawl) {
    fetched = (
      await db
        .select({ url: crawlArtifacts.url })
        .from(crawlArtifacts)
        .where(eq(crawlArtifacts.crawlId, latestCrawl.id))
    ).map((r) => r.url);
  }
  const notFound = new Set((stats.notFound ?? []).map(pageKey));
  const failed = new Set((stats.failed ?? []).map((f) => pageKey(f.url)));
  const fetchedKeys = new Set(fetched.map(pageKey));
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const url of [...(stats.discovered ?? []), ...fetched, ...pages.map((p) => p.url)]) {
    const key = pageKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    // Guessed pages that don't exist on this site are noise, not a sitemap.
    if (notFound.has(key)) continue;
    let status: PageStatus;
    if (learnedKeys.has(key)) status = 'read';
    else if (failed.has(key)) status = 'failed';
    else if (inFlight && fetchedKeys.has(key)) status = 'reading';
    else status = 'not_read';
    entries.push({ url, status, inCatalog: catalogKeys.has(key) });
  }

  const fmt = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not yet';
  const statusText = inFlight
    ? latestCrawl.status === 'extracting'
      ? `Reading now — learning ${latestCrawl.pageCount} pages…`
      : 'Reading now — fetching your pages…'
    : latestCrawl?.status === 'ok'
      ? 'Up to date'
      : latestCrawl?.status === 'failed'
        ? 'Last read failed — your assistant is still using the last good copy'
        : 'Not read yet';

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Your website"
        description="Your assistant reads your website so it can answer questions and take shoppers to the right page. Changed your site? Ask it to read again."
      />

      <div className="card-v2 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-text-secondary">Pages your assistant has learned</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-text-primary">{pages.length}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Last successful read</p>
            <p className="text-lg font-medium text-text-primary">{fmt(lastGood?.finishedAt)}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Status</p>
            <p className={`text-lg font-medium ${latestCrawl?.status === 'failed' ? 'text-red-600' : 'text-text-primary'}`}>
              {statusText}
            </p>
          </div>
        </div>
        <p className="sr-only">Graph version {merchantRow?.siteGraphVersion ?? 0}</p>

        <form action="/api/site-graph/refresh" method="post" className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" disabled={Boolean(inFlight)}>
            {inFlight ? 'Reading your pages…' : 'Re-read my pages'}
          </Button>
          {sp.read === 'started' ? (
            <p className="text-sm text-text-secondary" role="status">
              Started. A full read can take up to half an hour — your assistant keeps using what it already knows until then. Refresh to see progress.
            </p>
          ) : sp.read === 'busy' ? (
            <p className="text-sm text-text-secondary" role="status">
              Already reading your pages — no need to press again.
            </p>
          ) : null}
        </form>
      </div>

      <WebsiteSitemap entries={entries} initialExcluded={excluded} />

      <SiteTemplatesCard
        rescanQueued={sp.rescan === '1'}
        templates={templates.map((t) => ({
          pageType: t.pageType,
          status: t.status,
          scannedAt: t.scannedAt,
          scanTrigger: t.scanTrigger,
          recipes: t.recipes,
          sampleCount: t.sampleUrls.length,
        }))}
      />
    </div>
  );
}
