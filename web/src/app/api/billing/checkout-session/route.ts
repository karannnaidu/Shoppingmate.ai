import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { razorpay, PLAN_IDS } from '@/lib/razorpay';
import { readBody, respond } from '../../../../lib/billing-http';

type PlanKey = keyof typeof PLAN_IDS;

/** The plan the owner picked (form field or JSON `plan`); Starter by default. */
function pickPlan(raw: unknown): PlanKey {
  return raw === 'growth' || raw === 'scale' ? raw : 'starter';
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Previously every checkout created a STARTER subscription, so Growth and
  // Scale (sold on the pricing page) could not actually be bought.
  const plan = pickPlan((await readBody(req)).plan);
  const planId = PLAN_IDS[plan];
  if (!planId) return NextResponse.json({ error: `plan ${plan} is not available` }, { status: 400 });

  // Razorpay collects the customer on its hosted auth page; the customer_id
  // comes back on the subscription.activated webhook, with these notes.
  const subscription = (await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: { user_id: session.user.id, plan },
  })) as { id: string; short_url: string };

  return respond(req, { redirectTo: subscription.short_url, json: { url: subscription.short_url } });
}
