import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { siteGraphCrawlQueue, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { defaultAttribute } from '../conversion.js';
import type { OrderPayload, AttributeResult } from '../../services/attributeOrder.js';

export type ShopifyWebhookArgs = {
  rawBody: string;
  hmacHeader: string;
  shopDomain: string;
  lookupMerchantId: (domain: string) => Promise<string | null>;
  verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
  enqueueExtract: (args: { merchantId: string; urls: string[] }) => Promise<void>;
};

export async function handleShopifyProductWebhook(args: ShopifyWebhookArgs): Promise<{ status: number }> {
  if (!args.verifyHmac(args.rawBody, args.hmacHeader)) return { status: 401 };
  const merchantId = await args.lookupMerchantId(args.shopDomain);
  if (!merchantId) return { status: 404 };
  const payload = JSON.parse(args.rawBody) as { handle?: string };
  if (!payload.handle) return { status: 200 };
  await args.enqueueExtract({
    merchantId,
    urls: [`https://${args.shopDomain}/products/${payload.handle}`],
  });
  return { status: 200 };
}

export function defaultVerifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(hmacHeader));
  } catch { return false; }
}

export type ShopifyOrderWebhookArgs = {
  rawBody: string;
  hmacHeader: string;
  shopDomain: string;
  lookupMerchantId: (domain: string) => Promise<string | null>;
  verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
  attribute: (order: OrderPayload) => Promise<AttributeResult>;
};

export type ShopifyOrderWebhookResponse = {
  status: number;
  body?: { ok?: true; wrote?: string[]; skipped?: string; error?: string };
};

function dollarsToCents(amount: string | number): number {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  return Math.round(n * 100);
}

export async function handleShopifyOrderWebhook(
  args: ShopifyOrderWebhookArgs,
): Promise<ShopifyOrderWebhookResponse> {
  if (!args.verifyHmac(args.rawBody, args.hmacHeader)) {
    return { status: 401, body: { error: 'auth_failed' } };
  }

  let merchantId: string | null;
  try {
    merchantId = await args.lookupMerchantId(args.shopDomain);
  } catch (err) {
    console.error('[shopify-order] lookupMerchantId failed', { shopDomain: args.shopDomain, err });
    return { status: 500, body: { error: 'internal' } };
  }
  if (!merchantId) return { status: 404, body: { error: 'merchant_unknown' } };

  let payload: any;
  try {
    payload = JSON.parse(args.rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }

  const attrs: Array<{ name: string; value: string }> = payload.note_attributes ?? [];
  const visitorId = attrs.find((a) => a.name === 'sm_visitor_id')?.value;
  if (!visitorId) {
    return { status: 200, body: { ok: true, skipped: 'no_visitor_id' } };
  }

  const totalCents = dollarsToCents(payload.total_price ?? '0');
  if (!Number.isFinite(totalCents)) {
    return { status: 400, body: { error: 'invalid_amount' } };
  }

  const order: OrderPayload = {
    merchantId,
    orderId: String(payload.id),
    totalCents,
    currency: String(payload.currency ?? 'USD'),
    visitorId,
    occurredAt: new Date(payload.created_at ?? Date.now()),
    lineItems: (payload.line_items ?? []).map((li: any) => ({
      sku: String(li.sku ?? ''),
      quantity: Number(li.quantity ?? 1),
      priceCents: dollarsToCents(li.price ?? '0'),
    })),
    matchSource: 'shopify_webhook',
  };

  let result: AttributeResult;
  try {
    result = await args.attribute(order);
  } catch (err) {
    console.error('[shopify-order] attribute failed', { merchantId, orderId: order.orderId, err });
    return { status: 500, body: { error: 'internal' } };
  }
  return { status: 200, body: { ok: true, wrote: result.wrote } };
}

export const shopifyWebhookRoute = new Hono();

shopifyWebhookRoute.post('/products/update', async (c) => {
  const rawBody = await c.req.text();
  const hmacHeader = c.req.header('X-Shopify-Hmac-SHA256') ?? '';
  const shopDomain = c.req.header('X-Shopify-Shop-Domain') ?? '';
  const out = await handleShopifyProductWebhook({
    rawBody, hmacHeader, shopDomain,
    lookupMerchantId: async (d) => {
      const row = await db.query.merchants.findFirst({ where: eq(schema.merchants.domain, d) });
      return row?.id ?? null;
    },
    verifyHmac: defaultVerifyHmac,
    enqueueExtract: async ({ merchantId }) => {
      // Narrow re-extract for now is implemented as a full re-crawl;
      // a per-URL narrow path is a follow-up. Phase 1 acceptance:
      // the trigger fires and re-projects the cache.
      await siteGraphCrawlQueue.add('crawl', { merchantId });
    },
  });
  return c.body(null, out.status as never);
});

shopifyWebhookRoute.post('/orders/create', async (c) => {
  const rawBody = await c.req.text();
  const hmacHeader = c.req.header('X-Shopify-Hmac-SHA256') ?? '';
  const shopDomain = c.req.header('X-Shopify-Shop-Domain') ?? '';
  const out = await handleShopifyOrderWebhook({
    rawBody, hmacHeader, shopDomain,
    lookupMerchantId: async (d) => {
      const row = await db.query.merchants.findFirst({ where: eq(schema.merchants.domain, d) });
      return row?.id ?? null;
    },
    verifyHmac: defaultVerifyHmac,
    attribute: defaultAttribute,
  });
  return c.json(out.body ?? {}, out.status as 200 | 400 | 401 | 404 | 500);
});

void siteGraphExtractQueue;
