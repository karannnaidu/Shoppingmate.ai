import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDashboardSession } from '@/lib/session';
import { razorpay, TOPUP_AMOUNTS, BILLING_CURRENCY } from '@/lib/razorpay';

const Body = z.object({ topup_key: z.enum(['topup_50', 'topup_200', 'topup_1000', 'topup_5000']) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid topup_key' }, { status: 400 });

  const pack = TOPUP_AMOUNTS[parsed.data.topup_key];
  const link = (await razorpay.paymentLink.create({
    amount: pack.amount,
    currency: BILLING_CURRENCY,
    accept_partial: false,
    description: `shoppingmate top-up ${pack.label}`,
    reference_id: `topup_${session.merchant.id}_${parsed.data.topup_key}_${Date.now()}`,
    notify: { sms: false, email: true },
    notes: {
      user_id: session.user.id,
      topup_key: parsed.data.topup_key,
      merchant_id: session.merchant.id,
    },
  })) as { id: string; short_url: string };

  return NextResponse.json({ url: link.short_url });
}
