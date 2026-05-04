import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.stripeCustomerId) return NextResponse.json({ error: 'no stripe customer' }, { status: 400 });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const portal = await stripe.billingPortal.sessions.create({
    customer: m.stripeCustomerId,
    return_url: `${baseUrl}/app/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
