import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.squarespace' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

type SQVariant = {
  id: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
};

type SQProduct = {
  id: string;
  sku: string;
  title: string;
  body?: string;
  url: string;
  price: number;
  currency: string;
  inStock: boolean;
  variants?: SQVariant[];
  image?: string;
};

type SQPage = { products: SQProduct[]; total: number };

function normalize(domain: string, p: SQProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.title,
    description: p.body ?? null,
    imageUrl: p.image ?? null,
    productUrl: `https://${domain}${p.url}`,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      options: v.attributes,
      priceCents: v.price,
      inStock: v.stock > 0,
    })),
    priceCents: p.price,
    currency: p.currency,
    inStock: p.inStock,
    source: 'squarespace_commerce',
    sourceMeta: { sq_id: p.id },
  };
}

export async function fetchSquarespaceCatalog(
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
      const url = `https://${domain}/api/commerce/v1/products?limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ domain, offset, status: res.status }, 'squarespace commerce non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as SQPage;
      total = body.total ?? total;
      for (const item of body.products ?? []) {
        if (products.length >= opts.cap) break;
        products.push(normalize(domain, item));
      }
      if (!body.products || body.products.length < PAGE_SIZE) break;
      offset += body.products.length;
    } catch (err) {
      log.warn({ domain, offset, err: (err as Error).message }, 'squarespace fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { kind: 'ok', products, expected: total || products.length };
}
