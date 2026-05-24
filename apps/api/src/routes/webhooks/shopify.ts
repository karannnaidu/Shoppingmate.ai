import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { siteGraphCrawlQueue, siteGraphExtractQueue } from '@shoppingmate/jobs';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

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

void siteGraphExtractQueue;
