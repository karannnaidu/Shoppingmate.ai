import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

export async function POST(_req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.domain) return NextResponse.json({ ok: false, error: 'no domain' });

  const url = m.domain.startsWith('http') ? m.domain : `https://${m.domain}`;
  let html = '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    html = await res.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'fetch failed' });
  }

  const expectedNeedle = `data-id="${session.merchant.id}"`;
  const found = html.includes('cdn.shoppingmate.ai/widget') && html.includes(expectedNeedle);

  if (found) {
    await db.update(merchants).set({ lastWidgetPing: new Date() }).where(eq(merchants.id, session.merchant.id));
  }

  return NextResponse.json({ ok: found });
}
