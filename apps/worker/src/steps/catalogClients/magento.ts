import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.magento' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

type MagentoItem = {
  id: number;
  sku: string;
  name: string;
  price: number;
  custom_attributes?: Array<{ attribute_code: string; value: string }>;
  extension_attributes?: { stock_item?: { is_in_stock?: boolean; qty?: number } };
};

type MagentoPage = { items: MagentoItem[]; total_count: number };

function attr(p: MagentoItem, key: string): string | undefined {
  return p.custom_attributes?.find((a) => a.attribute_code === key)?.value;
}

function normalize(domain: string, p: MagentoItem): NormalizedProduct {
  const urlKey = attr(p, 'url_key') ?? p.sku.toLowerCase();
  const image = attr(p, 'image');
  return {
    sku: p.sku,
    title: p.name,
    description: attr(p, 'description') ?? null,
    imageUrl: image ? `https://${domain}${image}` : null,
    productUrl: `https://${domain}/${urlKey}.html`,
    variants: [],
    priceCents: Math.round((p.price ?? 0) * 100),
    currency: 'USD',
    inStock: p.extension_attributes?.stock_item?.is_in_stock ?? true,
    source: 'magento_rest',
    sourceMeta: { magento_id: p.id },
  };
}

export async function fetchMagentoCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let page = 1;
  let totalCount = 0;

  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const url =
        `https://${domain}/rest/V1/products` +
        `?searchCriteria%5BpageSize%5D=${PAGE_SIZE}` +
        `&searchCriteria%5BcurrentPage%5D=${page}`;
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        return { kind: 'failed', reason: 'requires_admin_token' };
      }
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'magento rest non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as MagentoPage;
      totalCount = body.total_count ?? totalCount;
      for (const item of body.items ?? []) {
        if (products.length >= opts.cap) break;
        products.push(normalize(domain, item));
      }
      if (!body.items || body.items.length < PAGE_SIZE) break;
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'magento fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { kind: 'ok', products, expected: totalCount || products.length };
}
