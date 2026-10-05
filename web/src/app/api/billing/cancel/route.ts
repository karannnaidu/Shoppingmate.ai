import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { razorpay } from '@/lib/razorpay';
import { respond } from '../../../../lib/billing-http';

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.razorpaySubscriptionId) return NextResponse.json({ error: 'no subscription' }, { status: 400 });

  // Second arg is a positional boolean (true = cancel at end of billing cycle).
  await razorpay.subscriptions.cancel(m.razorpaySubscriptionId, true);
  // Browser form → back to billing; fetch/test caller → JSON.
  return respond(req, { redirectTo: new URL('/app/billing', req.url).toString(), json: { ok: true } });
}
