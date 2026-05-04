import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const customer = await stripe.customers.create({
    email: session.user.email,
    metadata: { user_id: session.user.id },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS.starter_monthly, quantity: 1 }],
    success_url: `${baseUrl}/app/onboarding?step=3`,
    cancel_url: `${baseUrl}/app/onboarding?step=2`,
    metadata: { user_id: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
