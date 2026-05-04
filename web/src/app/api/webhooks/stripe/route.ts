import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { merchants, merchantOwners, stripeEvents } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { generateMerchantId } from '@/lib/merchant-id';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await req.text();
  let event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!) as unknown as typeof event;
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Idempotency check
  const existing = await db.query.stripeEvents.findFirst({ where: eq(stripeEvents.id, event.id) });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // Record event (receivedAt defaults via DB)
  await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type, payload: event as object })
    .onConflictDoNothing();

  switch (event.type) {
    case 'checkout.session.completed': {
      const obj = event.data.object as {
        customer: string;
        subscription?: string;
        mode?: string;
        metadata?: { user_id?: string; topup_key?: string };
        amount_total?: number;
      };
      const userId = obj.metadata?.user_id;
      if (!userId) break;

      if (obj.mode === 'subscription' && obj.subscription) {
        const merchantId = generateMerchantId();
        await db
          .insert(merchants)
          .values({
            id: merchantId,
            domain: `${merchantId.toLowerCase()}.pending`,
            // 'pending' is a valid MerchantStatus; 'catalog_pending' is not in the enum
            status: 'pending',
            plan: 'starter',
            billingStatus: 'active',
            stripeCustomerId: obj.customer,
            stripeSubscriptionId: obj.subscription,
          })
          .onConflictDoNothing();

        await db
          .insert(merchantOwners)
          .values({
            userId,
            merchantId,
            role: 'owner',
          })
          .onConflictDoNothing();
      } else if (obj.mode === 'payment' && obj.metadata?.topup_key) {
        const { TOPUP_QTYS } = await import('@/lib/stripe');
        const qty = TOPUP_QTYS[obj.metadata.topup_key as keyof typeof TOPUP_QTYS];
        if (qty !== undefined) {
          await db
            .update(merchants)
            .set({ topupBalance: qty })
            .where(eq(merchants.stripeCustomerId, obj.customer));
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const obj = event.data.object as { customer: string };
      await db
        .update(merchants)
        .set({ billingStatus: 'past_due' })
        .where(eq(merchants.stripeCustomerId, obj.customer));

      const m = await db.query.merchants.findFirst({
        where: eq(merchants.stripeCustomerId, obj.customer),
      });
      if (m) {
        const { createAlert } = await import('@/lib/alerts-repo');
        await createAlert({
          merchantId: m.id,
          kind: 'payment_failed',
          severity: 'critical',
          payload: {},
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const obj = event.data.object as { customer: string };
      await db
        .update(merchants)
        .set({ billingStatus: 'canceled' })
        .where(eq(merchants.stripeCustomerId, obj.customer));
      break;
    }
  }

  // Mark event processed
  await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.id, event.id));

  return NextResponse.json({ ok: true });
}
