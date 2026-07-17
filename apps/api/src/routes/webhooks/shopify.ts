import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { siteGraphCrawlQueue, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { db, schema, metricNames } from '@shoppingmate/db';
import type { NewProduct } from '@shoppingmate/db';
import { and, eq } from 'drizzle-orm';
import { defaultAttribute, defaultRecordMetric, type RecordMetricFn } from '../conversion.js';
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

// ---- Catalog freshness: products/create|update|delete ----------------------
// Keep the synced `products` table in step with the merchant's live Shopify
// catalog so the prices, stock, and NUMERIC variant ids the bot passes to
// cart.add stay correct without a full re-onboard. NOTE: these webhooks only
// fire once REGISTERED with Shopify — via the OAuth app (public listing) or a
// merchant's manual custom-app config. Until then the handlers are dormant and
// re-onboarding remains the refresh path.

type ShopifyVariantPayload = {
  id: number | string;
  sku?: string | null;
  price?: string;
  available?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};
type ShopifyProductPayload = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string | null;
  image?: { src: string } | null;
  images?: Array<{ src: string }>;
  variants?: ShopifyVariantPayload[];
};

function priceToCents(price: string | undefined): number | null {
  if (price == null) return null;
  const n = Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}
function variantOptions(v: ShopifyVariantPayload): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.option1) out.option1 = v.option1;
  if (v.option2) out.option2 = v.option2;
  if (v.option3) out.option3 = v.option3;
  return out;
}

/** Map a Shopify products/create|update webhook payload to a catalog row.
 *  Returns null when the payload has no handle (the products PK is merchant+sku,
 *  and we key sku on handle). Currency isn't in the webhook payload, so it's
 *  left null and preserved by the upsert rather than overwritten. */
export function shopifyProductPayloadToRow(
  payload: ShopifyProductPayload,
  shopDomain: string,
  merchantId: string,
): NewProduct | null {
  const handle = typeof payload.handle === 'string' ? payload.handle : '';
  if (!handle) return null;
  const variants = (payload.variants ?? []).map((v) => ({
    id: String(v.id),
    sku: v.sku ?? null,
    priceCents: priceToCents(v.price),
    inStock: v.available ?? null,
    options: variantOptions(v),
  }));
  const firstVar = payload.variants?.[0];
  return {
    merchantId,
    sku: handle,
    title: payload.title ?? handle,
    description: stripHtml(payload.body_html),
    imageUrl: payload.images?.[0]?.src ?? payload.image?.src ?? null,
    productUrl: `https://${shopDomain}/products/${handle}`,
    variants,
    priceCents: firstVar ? priceToCents(firstVar.price) : null,
    currency: null,
    inStock: (payload.variants ?? []).some((v) => v.available === true),
    source: 'shopify_storefront',
    sourceMeta: null,
  };
}

export type ShopifyCatalogUpsertArgs = {
  rawBody: string;
  hmacHeader: string;
  shopDomain: string;
  lookupMerchantId: (domain: string) => Promise<string | null>;
  verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
  upsertProduct: (row: NewProduct) => Promise<void>;
  enqueueReindex?: (merchantId: string) => Promise<void>;
};

export async function handleShopifyCatalogUpsert(
  args: ShopifyCatalogUpsertArgs,
): Promise<{ status: number }> {
  if (!args.verifyHmac(args.rawBody, args.hmacHeader)) return { status: 401 };
  const merchantId = await args.lookupMerchantId(args.shopDomain);
  if (!merchantId) return { status: 404 };
  let payload: ShopifyProductPayload;
  try {
    payload = JSON.parse(args.rawBody) as ShopifyProductPayload;
  } catch {
    return { status: 400 };
  }
  const row = shopifyProductPayloadToRow(payload, args.shopDomain, merchantId);
  if (!row) return { status: 200 };
  await args.upsertProduct(row);
  if (args.enqueueReindex) await args.enqueueReindex(merchantId);
  return { status: 200 };
}

export type ShopifyCatalogDeleteArgs = {
  rawBody: string;
  hmacHeader: string;
  shopDomain: string;
  lookupMerchantId: (domain: string) => Promise<string | null>;
  verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
  deleteProduct: (merchantId: string, sku: string) => Promise<void>;
};

export async function handleShopifyCatalogDelete(
  args: ShopifyCatalogDeleteArgs,
): Promise<{ status: number }> {
  if (!args.verifyHmac(args.rawBody, args.hmacHeader)) return { status: 401 };
  const merchantId = await args.lookupMerchantId(args.shopDomain);
  if (!merchantId) return { status: 404 };
  let payload: { handle?: string };
  try {
    payload = JSON.parse(args.rawBody) as { handle?: string };
  } catch {
    return { status: 400 };
  }
  if (!payload.handle) return { status: 200 };
  await args.deleteProduct(merchantId, payload.handle);
  return { status: 200 };
}

export type ShopifyOrderWebhookArgs = {
  rawBody: string;
  hmacHeader: string;
  shopDomain: string;
  lookupMerchantId: (domain: string) => Promise<string | null>;
  verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
  attribute: (order: OrderPayload) => Promise<AttributeResult>;
  recordMetric: RecordMetricFn;
};

export type ShopifyOrderWebhookResponse = {
  status: number;
  body?: {
    ok?: true;
    wrote?: AttributeResult['wrote'];
    skipped?: string[];
    missReason?: string | null;
    error?: string;
  };
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

  const attrs = Array.isArray(payload.note_attributes) ? payload.note_attributes : [];
  let visitorId: string | undefined;
  for (const entry of attrs) {
    if (
      typeof entry?.name === 'string' &&
      typeof entry?.value === 'string' &&
      entry.name === 'sm_visitor_id'
    ) {
      visitorId = entry.value;
      break;
    }
  }
  if (!visitorId) {
    // merchantId is known here; emit no_visitor miss counter.
    try {
      await args.recordMetric({
        merchantId,
        metricName: metricNames.conversionMissNoVisitor,
        tags: { source: 'shopify_webhook' },
      });
    } catch (err) {
      console.error('[shopify-order] recordMetric failed', { shopDomain: args.shopDomain, merchantId, err });
    }
    return {
      status: 200,
      body: {
        ok: true,
        wrote: [],
        skipped: ['no_visitor_id'],
        missReason: null,
      },
    };
  }

  const totalCents = dollarsToCents(payload.total_price ?? '0');
  if (!Number.isFinite(totalCents) || totalCents < 0) {
    return { status: 400, body: { error: 'invalid_amount' } };
  }

  const occurredAtRaw = payload.created_at ?? Date.now();
  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    return { status: 400, body: { error: 'invalid_occurred_at' } };
  }

  const rawLineItems: any[] = Array.isArray(payload.line_items) ? payload.line_items : [];
  const lineItems: OrderPayload['lineItems'] = [];
  for (const li of rawLineItems) {
    const priceCents = dollarsToCents(li?.price ?? '0');
    const quantity = Number(li?.quantity ?? 1);
    if (!Number.isFinite(priceCents) || !Number.isFinite(quantity)) {
      return { status: 400, body: { error: 'invalid_amount' } };
    }
    lineItems.push({
      sku: String(li?.sku ?? ''),
      quantity,
      priceCents,
    });
  }

  const order: OrderPayload = {
    merchantId,
    orderId: String(payload.id),
    totalCents,
    currency: String(payload.currency ?? 'USD'),
    visitorId,
    occurredAt,
    lineItems,
    matchSource: 'shopify_webhook',
  };

  let result: AttributeResult;
  try {
    result = await args.attribute(order);
  } catch (err) {
    console.error('[shopify-order] attribute failed', { merchantId, orderId: order.orderId, err });
    return { status: 500, body: { error: 'internal' } };
  }

  // Emit telemetry counters. Auth-failed / merchant-unknown branches don't emit
  // because the DB FK on metric_events requires a valid merchantId we don't have there.
  // AttributeResult.skipped is typed Array<'assisted'|'influenced'> — no 'no_visitor_id'
  // reaches this path; that case is handled by the early-return branch above.
  try {
    await Promise.all([
      ...result.wrote.map((kind) =>
        args.recordMetric({
          merchantId,
          metricName: metricNames.conversionIngested,
          tags: { source: 'shopify_webhook', kind },
        }),
      ),
      ...result.skipped.map((kind) =>
        args.recordMetric({
          merchantId,
          metricName: metricNames.conversionMissDuplicate,
          tags: { source: 'shopify_webhook', kind },
        }),
      ),
      ...(result.missReason === 'no_recommendation_match'
        ? [
            args.recordMetric({
              merchantId,
              metricName: metricNames.conversionMissNoRecommendation,
              tags: { source: 'shopify_webhook' },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    console.error('[shopify-order] recordMetric failed', { merchantId, err });
  }

  return {
    status: 200,
    body: {
      ok: true,
      wrote: result.wrote,
      skipped: result.skipped,
      missReason: result.missReason,
    },
  };
}

export const shopifyWebhookRoute = new Hono();

const lookupMerchantByDomain = async (d: string): Promise<string | null> => {
  const row = await db.query.merchants.findFirst({ where: eq(schema.merchants.domain, d) });
  return row?.id ?? null;
};

const dbUpsertProduct = async (row: NewProduct): Promise<void> => {
  // Preserve currency + source (not in the webhook payload) on update; refresh
  // the volatile fields the bot reads (price, stock, variant ids, media).
  await db
    .insert(schema.products)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.products.merchantId, schema.products.sku],
      set: {
        title: row.title,
        description: row.description,
        imageUrl: row.imageUrl,
        productUrl: row.productUrl,
        variants: row.variants,
        priceCents: row.priceCents,
        inStock: row.inStock,
        indexedAt: new Date(),
      },
    });
};

const dbDeleteProduct = async (merchantId: string, sku: string): Promise<void> => {
  await db
    .delete(schema.products)
    .where(and(eq(schema.products.merchantId, merchantId), eq(schema.products.sku, sku)));
};

const productHeaders = (c: { req: { header: (n: string) => string | undefined } }) => ({
  hmacHeader: c.req.header('X-Shopify-Hmac-SHA256') ?? '',
  shopDomain: c.req.header('X-Shopify-Shop-Domain') ?? '',
});

shopifyWebhookRoute.post('/products/create', async (c) => {
  const rawBody = await c.req.text();
  const out = await handleShopifyCatalogUpsert({
    rawBody,
    ...productHeaders(c),
    lookupMerchantId: lookupMerchantByDomain,
    verifyHmac: defaultVerifyHmac,
    upsertProduct: dbUpsertProduct,
  });
  return c.body(null, out.status as never);
});

shopifyWebhookRoute.post('/products/update', async (c) => {
  const rawBody = await c.req.text();
  const out = await handleShopifyCatalogUpsert({
    rawBody,
    ...productHeaders(c),
    lookupMerchantId: lookupMerchantByDomain,
    verifyHmac: defaultVerifyHmac,
    upsertProduct: dbUpsertProduct,
    // Also refresh the site graph / KB (nav + policy pages) on a product edit.
    enqueueReindex: async (merchantId) => {
      await siteGraphCrawlQueue.add('crawl', { merchantId });
    },
  });
  return c.body(null, out.status as never);
});

shopifyWebhookRoute.post('/products/delete', async (c) => {
  const rawBody = await c.req.text();
  const out = await handleShopifyCatalogDelete({
    rawBody,
    ...productHeaders(c),
    lookupMerchantId: lookupMerchantByDomain,
    verifyHmac: defaultVerifyHmac,
    deleteProduct: dbDeleteProduct,
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
    recordMetric: defaultRecordMetric,
  });
  return c.json(out.body ?? {}, out.status as 200 | 400 | 401 | 404 | 500);
});

void siteGraphExtractQueue;
