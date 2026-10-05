import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { razorpay, PLAN_IDS } from '@/lib/razorpay';
import { respond } from '../../../../lib/billing-http';

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Razorpay collects the customer on its hosted auth page; the customer_id
  // comes back on the subscription.activated webhook. We only carry user_id.
  const subscription = (await razorpay.subscriptions.create({
    plan_id: PLAN_IDS.starter,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: { user_id: session.user.id },
  })) as { id: string; short_url: string };

  return respond(req, { redirectTo: subscription.short_url, json: { url: subscription.short_url } });
}
