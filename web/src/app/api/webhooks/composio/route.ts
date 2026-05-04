import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { verifyComposioSignature } from '@/lib/composio-verify';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyComposioSignature({
    secret: process.env.COMPOSIO_WEBHOOK_SECRET!,
    webhookId: req.headers.get('webhook-id') ?? undefined,
    webhookTimestamp: req.headers.get('webhook-timestamp') ?? undefined,
    webhookSignature: req.headers.get('webhook-signature') ?? undefined,
    rawBody,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.reason }, { status: 400 });

  const event = JSON.parse(rawBody) as { type: string; data: Record<string, unknown> };
  const url = new URL(req.url);
  const queryMerchantId = url.searchParams.get('merchant_id');

  if (event.type === 'connection.activated') {
    const data = event.data as { connection_id: string; metadata?: { merchant_id?: string } };
    const merchantId = queryMerchantId ?? data.metadata?.merchant_id;
    if (!merchantId) return NextResponse.json({ ok: true, ignored: true });

    await db.update(merchants).set({
      adapterType: 'shopify',
      adapterConfig: { type: 'shopify', composio_connection_id: data.connection_id },
      status: 'onboarding',
    }).where(eq(merchants.id, merchantId));
  }

  return NextResponse.json({ ok: true });
}
