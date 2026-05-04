import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe, PRICE_IDS } from '@/lib/stripe';

const Body = z.object({ topup_key: z.enum(['topup_50', 'topup_200', 'topup_1000', 'topup_5000']) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid topup_key' }, { status: 400 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.stripeCustomerId) return NextResponse.json({ error: 'no stripe customer' }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const cs = await stripe.checkout.sessions.create({
    customer: m.stripeCustomerId,
    mode: 'payment',
    line_items: [{ price: PRICE_IDS[parsed.data.topup_key], quantity: 1 }],
    success_url: `${baseUrl}/app/billing?topup=ok`,
    cancel_url: `${baseUrl}/app/billing?topup=cancel`,
    metadata: { user_id: session.user.id, topup_key: parsed.data.topup_key, merchant_id: session.merchant.id },
  });
  return NextResponse.json({ url: cs.url });
}
