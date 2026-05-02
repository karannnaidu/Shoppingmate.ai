import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.wix' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';
const BASE_PATH = '/_api/wix-ecommerce-storefront-web/api/storefront/products';

type WixProduct = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  priceData: { price: number; currency: string };
  media?: { mainMedia?: { image?: { url: string } } };
  productPageUrl: { base: string; path: string };
  stock?: { inStock?: boolean };
};

type WixPage = { products: WixProduct[]; totalResults: number };

function normalize(p: WixProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.name,
    description: p.description ?? null,
    imageUrl: p.media?.mainMedia?.image?.url ?? null,
    productUrl: `${p.productPageUrl.base}${p.productPageUrl.path}`,
    variants: [],
    priceCents: Math.round(p.priceData.price * 100),
    currency: p.priceData.currency,
    inStock: p.stock?.inStock ?? true,
    source: 'wix_stores',
    sourceMeta: { wix_id: p.id },
  };
}

export async function fetchWixCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let offset = 0;
  let total = 0;

  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const url = `https://${domain}${BASE_PATH}?limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ domain, offset, status: res.status }, 'wix storefront non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as WixPage;
      total = body.totalResults ?? total;
      for (const item of body.products ?? []) {
        if (products.length >= opts.cap) break;
        products.push(normalize(item));
      }
      if (!body.products || body.products.length < PAGE_SIZE) break;
      offset += body.products.length;
    } catch (err) {
      log.warn({ domain, offset, err: (err as Error).message }, 'wix fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { kind: 'ok', products, expected: total || products.length };
}
