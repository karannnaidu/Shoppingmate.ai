import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ step: 'catalogSync.shopify' });
const PAGE_SIZE = 250;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export type NormalizedProduct = {
  sku: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  productUrl: string;
  variants: Array<{
    id: string;
    sku: string | null;
    priceCents: number | null;
    inStock: boolean | null;
    options: Record<string, string>;
  }>;
  priceCents: number | null;
  currency: string | null;
  inStock: boolean | null;
  source:
    | 'shopify_storefront'
    | 'woo_store_api'
    | 'dom_crawl'
    | 'magento_rest'
    | 'bigcommerce_storefront'
    | 'wix_stores'
    | 'squarespace_commerce';
  sourceMeta?: Record<string, unknown>;
};

type ShopifyResp = {
  products: Array<{
    id: number;
    title: string;
    body_html: string | null;
    handle: string;
    image: { src: string } | null;
    images?: Array<{ src: string }>;
    variants: Array<{
      id: number;
      sku: string | null;
      price: string;
      available: boolean;
      option1?: string | null;
      option2?: string | null;
      option3?: string | null;
    }>;
  }>;
};

export type CatalogClientResult =
  | { kind: 'ok'; products: NormalizedProduct[]; expected: number }
  | { kind: 'failed'; reason: string };

function priceToCents(price: string): number | null {
  const n = Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

function variantOptions(v: ShopifyResp['products'][0]['variants'][0]): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.option1) out.option1 = v.option1;
  if (v.option2) out.option2 = v.option2;
  if (v.option3) out.option3 = v.option3;
  return out;
}

// Read the shop's presentment currency (ISO code) from /cart.js. Best-effort:
// returns 'USD' if the endpoint is unavailable or malformed.
async function fetchShopCurrency(domain: string, userAgent: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`https://${domain}/cart.js`, {
        headers: { 'user-agent': userAgent, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return 'USD';
      const body = (await res.json()) as { currency?: unknown };
      return typeof body.currency === 'string' && body.currency.length === 3 ? body.currency : 'USD';
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return 'USD';
  }
}

export async function fetchShopifyCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  // The shop's presentment currency isn't in /products.json — fetch it once from
  // /cart.js (which returns e.g. {"currency":"INR"}). Defaults to USD on failure.
  const currency = await fetchShopCurrency(domain, USER_AGENT);
  let page = 1;
  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(`https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'shopify products.json non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as ShopifyResp;
      if (!body.products?.length) break;
      for (const p of body.products) {
        if (products.length >= opts.cap) break;
        const firstVar = p.variants[0];
        products.push({
          sku: p.handle,
          title: p.title,
          description: stripHtml(p.body_html),
          // Products expose their gallery in `images[]`; the top-level `image`
          // is often null, so prefer the first gallery image.
          imageUrl: p.images?.[0]?.src ?? p.image?.src ?? null,
          productUrl: `https://${domain}/products/${p.handle}`,
          priceCents: firstVar ? priceToCents(firstVar.price) : null,
          currency,
          inStock: p.variants.some((v) => v.available),
          variants: p.variants.map((v) => ({
            id: String(v.id),
            sku: v.sku,
            priceCents: priceToCents(v.price),
            inStock: v.available,
            options: variantOptions(v),
          })),
          source: 'shopify_storefront',
        });
      }
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'shopify fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'ok', products, expected: products.length };
}
