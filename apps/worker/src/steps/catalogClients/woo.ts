import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.woo' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description: string | null;
  images: Array<{ src: string }>;
  prices: { price: string; currency_code: string; currency_minor_unit: number };
  is_in_stock: boolean;
  variations?: number[];
};

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}

function priceToCents(price: string, minorUnit: number): number | null {
  const n = Number.parseInt(price, 10);
  if (!Number.isFinite(n)) return null;
  return minorUnit === 2 ? n : Math.round((n / 10 ** minorUnit) * 100);
}

export async function fetchWooCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let page = 1;
  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(
        `https://${domain}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`,
        {
          headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'woo store api non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as WooProduct[];
      if (!body.length) break;
      for (const p of body) {
        if (products.length >= opts.cap) break;
        products.push({
          sku: p.slug,
          title: p.name,
          description: stripHtml(p.description),
          imageUrl: p.images[0]?.src ?? null,
          productUrl: p.permalink,
          priceCents: priceToCents(p.prices.price, p.prices.currency_minor_unit),
          currency: p.prices.currency_code,
          inStock: p.is_in_stock,
          variants: [],
          source: 'woo_store_api',
        });
      }
      if (body.length < PAGE_SIZE) break;
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'woo fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'ok', products, expected: products.length };
}
