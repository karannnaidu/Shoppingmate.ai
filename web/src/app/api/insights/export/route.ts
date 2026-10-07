import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildInsightFacts } from '@shoppingmate/db/insights';
import { hasFeature } from '@shoppingmate/db/plans';
import { db } from '@/lib/db';
import { getDashboardSession } from '@/lib/session';
import { insightsCsv } from '@/lib/insights-export';

// Scale plan: download Store Insights as a CSV for the owner's team.
export async function GET(req: Request) {
  const session = await getDashboardSession({ headers: await headers() });
  const m = session?.merchant;
  if (!m) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasFeature(m, 'insights_export')) {
    return NextResponse.json({ error: 'Exports are included in the Scale plan.' }, { status: 403 });
  }
  const daysParam = Number(new URL(req.url).searchParams.get('days') ?? '7');
  const days = daysParam === 30 ? 30 : 7;
  const facts = await buildInsightFacts(db, m.id, { days });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(insightsCsv(facts), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="store-insights-${days}d-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
