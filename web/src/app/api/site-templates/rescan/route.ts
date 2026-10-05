import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { siteTemplateScanQueue } from '@shoppingmate/jobs';

// Nav Phase 2: owner-triggered re-scan of the store's page layouts.
export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await siteTemplateScanQueue.add('scan', { merchantId: session.merchant.id, trigger: 'manual' });

  return NextResponse.redirect(new URL('/app/site-graph?rescan=1', req.url), 303);
}
