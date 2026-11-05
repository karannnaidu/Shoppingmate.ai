import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { enqueueSiteCrawl, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { normalizeExclusion } from '@shoppingmate/shared/sitemap';

const MAX_RULES = 500;

// "Your website" sitemap: the owner picks folders / pages the assistant should
// NOT learn from. Newly-skipped pages leave the knowledge base right away (the
// worker prunes + refreshes the assistant's summary in seconds); un-skipped
// ones need the pages read again, so that queues a re-read.
export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  const raw = (body as { excluded?: unknown })?.excluded;
  if (!Array.isArray(raw) || raw.length > MAX_RULES || !raw.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'excluded must be a list of paths' }, { status: 400 });
  }
  const next = [
    ...new Set(
      (raw as string[])
        .map((p) => normalizeExclusion(p, p.trim().endsWith('/')))
        .filter((p): p is string => p !== null),
    ),
  ].sort();

  const merchantId = session.merchant.id;
  const [current] = await db
    .select({ kbExcludedPaths: merchants.kbExcludedPaths })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  const before = new Set((current?.kbExcludedPaths ?? []) as string[]);
  const reincluded = [...before].filter((p) => !next.includes(p));

  await db.update(merchants).set({ kbExcludedPaths: next }).where(eq(merchants.id, merchantId));
  await siteGraphExtractQueue.add('apply-exclusions', { merchantId });
  let reread = false;
  if (reincluded.length > 0) reread = (await enqueueSiteCrawl(merchantId)).queued;

  return NextResponse.json({ ok: true, excluded: next, reread, reincluded });
}
