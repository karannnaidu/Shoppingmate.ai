import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { siteGraphCrawlQueue } from '@shoppingmate/jobs';

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await siteGraphCrawlQueue.add('crawl', { merchantId: session.merchant.id });

  return NextResponse.redirect(new URL('/app/site-graph', req.url), 303);
}
