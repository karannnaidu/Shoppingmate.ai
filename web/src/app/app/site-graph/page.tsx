import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { siteCrawls, sitePages, merchants } from '@shoppingmate/db/schema';
import { eq, desc } from 'drizzle-orm';

export default async function SiteGraphPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const [latestCrawl] = await db
    .select({
      id: siteCrawls.id,
      startedAt: siteCrawls.startedAt,
      finishedAt: siteCrawls.finishedAt,
      status: siteCrawls.status,
      pageCount: siteCrawls.pageCount,
    })
    .from(siteCrawls)
    .where(eq(siteCrawls.merchantId, session.merchant.id))
    .orderBy(desc(siteCrawls.startedAt))
    .limit(1);

  const pageCount = await db.$count(sitePages, eq(sitePages.merchantId, session.merchant.id));

  const [merchantRow] = await db
    .select({ siteGraphVersion: merchants.siteGraphVersion })
    .from(merchants)
    .where(eq(merchants.id, session.merchant.id));

  const siteGraphVersion = merchantRow?.siteGraphVersion ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
        Site Graph
      </h1>

      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-text-secondary">Pages indexed</p>
            <p className="text-lg font-medium text-text-primary">{pageCount}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Graph version</p>
            <p className="text-lg font-medium text-text-primary">{siteGraphVersion}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Last refresh</p>
            <p className="text-lg font-medium text-text-primary">
              {latestCrawl?.finishedAt
                ? latestCrawl.finishedAt.toISOString()
                : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Status</p>
            <p className="text-lg font-medium text-text-primary capitalize">
              {latestCrawl?.status ?? 'No crawl yet'}
            </p>
          </div>
        </div>

        <form action="/api/site-graph/refresh" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            Refresh now
          </button>
        </form>
      </div>
    </div>
  );
}
