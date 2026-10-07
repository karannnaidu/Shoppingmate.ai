import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { siteCrawls, sitePages, merchants, siteTemplates } from '@shoppingmate/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { SiteTemplatesCard } from '@/components/site-templates-card';
import { Button } from '@/components/ui/button';
import { DashHeader } from '@/components/dashboard/v2';

export default async function SiteGraphPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  const sp = (await searchParams) ?? {};

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
    .where(eq(siteTemplates.merchantId, session.merchant.id))
    .orderBy(asc(siteTemplates.pageType));

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
      <DashHeader
        title="Your website"
        description="Your assistant reads your website so it can answer questions and take shoppers to the right page. Changed your site? Ask it to read again."
      />

      <div className="card-v2 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-text-secondary">Pages your assistant has read</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-text-primary">{pageCount}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Last read</p>
            <p className="text-lg font-medium text-text-primary">
              {latestCrawl?.finishedAt
                ? latestCrawl.finishedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Not yet'}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Status</p>
            <p className="text-lg font-medium text-text-primary">
              {latestCrawl?.status === 'ok'
                ? 'Up to date'
                : latestCrawl?.status === 'running' || latestCrawl?.status === 'pending'
                  ? 'Reading now…'
                  : latestCrawl?.status === 'failed'
                    ? 'Last read failed — try again'
                    : 'Not read yet'}
            </p>
          </div>
        </div>
        <p className="sr-only">Graph version {siteGraphVersion}</p>

        <form action="/api/site-graph/refresh" method="post" className="mt-6">
          <Button type="submit" variant="outline">
            Re-read my pages
          </Button>
        </form>
      </div>

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
