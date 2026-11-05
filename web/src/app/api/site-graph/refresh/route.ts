import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { siteCrawls } from '@shoppingmate/db/schema';
import { enqueueSiteCrawl } from '@shoppingmate/jobs';

/** A read older than this that never finished is treated as dead. */
const STUCK_AFTER_MS = 60 * 60_000;

// One read at a time per store: a click while a read is queued, fetching or
// still being read is absorbed (2026-11-05: three clicks = three parallel
// reads that crashed into each other and emptied the knowledge base).
export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [latest] = await db
    .select({ status: siteCrawls.status, startedAt: siteCrawls.startedAt })
    .from(siteCrawls)
    .where(eq(siteCrawls.merchantId, session.merchant.id))
    .orderBy(desc(siteCrawls.startedAt))
    .limit(1);
  const inFlight =
    latest &&
    ['pending', 'running', 'extracting'].includes(latest.status) &&
    Date.now() - latest.startedAt.getTime() < STUCK_AFTER_MS;

  const queued = inFlight ? false : (await enqueueSiteCrawl(session.merchant.id)).queued;

  return NextResponse.redirect(new URL(`/app/site-graph?read=${queued ? 'started' : 'busy'}`, req.url), 303);
}
