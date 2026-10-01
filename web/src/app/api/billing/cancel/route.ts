import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { razorpay } from '@/lib/razorpay';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.razorpaySubscriptionId) return NextResponse.json({ error: 'no subscription' }, { status: 400 });

  await razorpay.subscriptions.cancel(m.razorpaySubscriptionId, { cancel_at_cycle_end: true });
  return NextResponse.json({ ok: true });
}
