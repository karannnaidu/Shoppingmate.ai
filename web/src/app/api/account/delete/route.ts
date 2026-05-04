import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants, sessions } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (m?.stripeSubscriptionId) {
    try { await stripe.subscriptions.cancel(m.stripeSubscriptionId); } catch { /* ignore */ }
  }
  await db.update(merchants).set({ deletedAt: new Date(), billingStatus: 'canceled' }).where(eq(merchants.id, session.merchant.id));
  await db.delete(sessions).where(eq(sessions.userId, session.user.id));
  return NextResponse.json({ ok: true });
}
