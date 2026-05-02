import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.bigcommerce' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

type BCVariant = {
  id: number;
  sku: string;
  price: number;
  option_values: Array<{ label: string; option_display_name: string }>;
  inventory_level?: number;
};

type BCProduct = {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price: number;
  url: string;
  default_image?: { url_standard?: string };
  inventory_level?: number;
  variants?: BCVariant[];
};

type BCPage = {
  data: BCProduct[];
  meta: { pagination: { total_pages: number; current_page: number; total: number } };
};

function normalize(domain: string, p: BCProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.name,
    description: p.description ?? null,
    imageUrl: p.default_image?.url_standard ?? null,
    productUrl: `https://${domain}${p.url}`,
    variants: (p.variants ?? []).map((v) => ({
      id: String(v.id),
      sku: v.sku,
      options: Object.fromEntries(v.option_values.map((o) => [o.option_display_name, o.label])),
      priceCents: Math.round((v.price ?? 0) * 100),
      inStock: (v.inventory_level ?? 1) > 0,
    })),
    priceCents: Math.round((p.price ?? 0) * 100),
    currency: 'USD',
    inStock: (p.inventory_level ?? 1) > 0,
    source: 'bigcommerce_storefront',
    sourceMeta: { bc_id: p.id },
  };
}

export async function fetchBigCommerceCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let page = 1;
  let totalPages = 1;
  let total = 0;

  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const url = `https://${domain}/api/storefront/products?limit=${PAGE_SIZE}&page=${page}`;
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'bigcommerce storefront non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as BCPage;
      totalPages = body.meta?.pagination?.total_pages ?? totalPages;
      total = body.meta?.pagination?.total ?? total;
      for (const item of body.data ?? []) {
        if (products.length >= opts.cap) break;
        products.push(normalize(domain, item));
      }
      if (page >= totalPages) break;
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'bigcommerce fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { kind: 'ok', products, expected: total || products.length };
}
