import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { alerts, merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const alert = await db.query.alerts.findFirst({ where: eq(alerts.id, id) });
  if (!alert || alert.merchantId !== session.merchant.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  if (alert.kind === 'override_failing') {
    const payload = alert.payload as { selector_key: string; suggested: string };
    const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
    const config = (m?.adapterConfig ?? {}) as Record<string, unknown>;
    const selectors = (config.selectors ?? {}) as Record<string, { value: string; source: string }>;
    selectors[payload.selector_key] = { value: payload.suggested, source: 'merchant_override' };
    await db.update(merchants)
      .set({ adapterConfig: { ...config, selectors } })
      .where(eq(merchants.id, session.merchant.id));
  }

  await db.update(alerts).set({ resolvedAt: new Date(), acknowledgedAt: new Date() }).where(eq(alerts.id, id));

  return NextResponse.redirect(new URL('/app', _req.url), 303);
}
