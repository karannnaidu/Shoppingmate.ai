import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateWebhookSignature, TOPUP_QTYS, PLAN_IDS } from '@/lib/razorpay';
import { merchants, merchantOwners, razorpayEvents } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateMerchantId } from '../../../../lib/merchant-id';
import { planFromSubscription } from '../../../../lib/plan-from-subscription';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('x-razorpay-signature');
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!sig || !eventId) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await req.text();
  let valid = false;
  try {
    valid = validateWebhookSignature(rawBody, sig, process.env.RAZORPAY_WEBHOOK_SECRET!);
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 400 });

  const event = JSON.parse(rawBody) as {
    event: string;
    payload: Record<string, { entity: Record<string, unknown> }>;
  };

  // Idempotency keyed on the Razorpay event-id header (no id in the body).
  const existing = await db.query.razorpayEvents.findFirst({ where: eq(razorpayEvents.id, eventId) });
  if (existing?.processedAt) return NextResponse.json({ ok: true, idempotent: true });

  await db
    .insert(razorpayEvents)
    .values({ id: eventId, type: event.event, payload: event as object })
    .onConflictDoNothing();

  // Attribute this event to a merchant so the dashboard can show a per-merchant
  // transaction history. Set in each branch where the merchant is known.
  let resolvedMerchantId: string | null = null;

  switch (event.event) {
    case 'subscription.activated': {
      const sub = event.payload.subscription?.entity as {
        id: string;
        customer_id: string;
        plan_id?: string;
        notes?: { user_id?: string; plan?: string };
      };
      const userId = sub?.notes?.user_id;
      if (!userId) break;
      const plan = planFromSubscription(sub, PLAN_IDS ?? {});
      // An owner who already has a store (re-subscribing after a cancel, or
      // switching plan) keeps THAT store. Previously every activation minted a
      // brand-new merchant, splitting their data across two stores.
      const owned = await db.query.merchantOwners.findFirst({ where: eq(merchantOwners.userId, userId) });
      if (owned) {
        resolvedMerchantId = owned.merchantId;
        await db
          .update(merchants)
          .set({
            plan,
            billingStatus: 'active',
            razorpayCustomerId: sub.customer_id,
            razorpaySubscriptionId: sub.id,
          })
          .where(eq(merchants.id, owned.merchantId));
        break;
      }
      const merchantId = generateMerchantId();
      resolvedMerchantId = merchantId;
      await db
        .insert(merchants)
        .values({
          id: merchantId,
          domain: `${merchantId.toLowerCase()}.pending`,
          status: 'pending',
          plan,
          billingStatus: 'active',
          razorpayCustomerId: sub.customer_id,
          razorpaySubscriptionId: sub.id,
        })
        .onConflictDoNothing();
      await db.insert(merchantOwners).values({ userId, merchantId, role: 'owner' }).onConflictDoNothing();
      break;
    }

    case 'payment_link.paid': {
      const link = event.payload.payment_link?.entity as {
        notes?: { topup_key?: string; merchant_id?: string };
      };
      const topupKey = link?.notes?.topup_key;
      const merchantId = link?.notes?.merchant_id;
      if (merchantId) resolvedMerchantId = merchantId;
      if (topupKey && merchantId) {
        const qty = TOPUP_QTYS[topupKey as keyof typeof TOPUP_QTYS];
        if (qty !== undefined) {
          // ADD to the balance — this used to overwrite it, so a second pack
          // wiped the first ("top-ups carry over" was false).
          await db
            .update(merchants)
            .set({ topupBalance: sql`${merchants.topupBalance} + ${qty}` })
            .where(eq(merchants.id, merchantId));
        }
      }
      break;
    }

    case 'subscription.pending':
    case 'payment.failed': {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (sub?.id) {
        await db.update(merchants).set({ billingStatus: 'past_due' }).where(eq(merchants.razorpaySubscriptionId, sub.id));
        const m = await db.query.merchants.findFirst({ where: eq(merchants.razorpaySubscriptionId, sub.id) });
        if (m) {
          resolvedMerchantId = m.id;
          const { createAlert } = await import('@/lib/alerts-repo');
          await createAlert({ merchantId: m.id, kind: 'payment_failed', severity: 'critical', payload: {} });
        }
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (sub?.id) {
        const m = await db.query.merchants.findFirst({ where: eq(merchants.razorpaySubscriptionId, sub.id) });
        if (m) resolvedMerchantId = m.id;
        await db.update(merchants).set({ billingStatus: 'canceled' }).where(eq(merchants.razorpaySubscriptionId, sub.id));
      }
      break;
    }
  }

  await db
    .update(razorpayEvents)
    .set({ processedAt: new Date(), merchantId: resolvedMerchantId })
    .where(eq(razorpayEvents.id, eventId));
  return NextResponse.json({ ok: true });
}
