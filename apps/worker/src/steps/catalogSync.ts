import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { fetchBigCommerceCatalog } from './catalogClients/bigcommerce.js';
import { fetchDomCatalog } from './catalogClients/domCrawl.js';
import { fetchMagentoCatalog } from './catalogClients/magento.js';
import { fetchShopifyCatalog } from './catalogClients/shopify.js';
import type { CatalogClientResult, NormalizedProduct } from './catalogClients/shopify.js';
import { fetchSquarespaceCatalog } from './catalogClients/squarespace.js';
import { fetchWixCatalog } from './catalogClients/wix.js';
import { fetchWooCatalog } from './catalogClients/woo.js';

const log = childLogger({ step: 'catalogSync' });
const PARTIAL_THRESHOLD = 0.8;

export type CatalogSyncResult =
  | { kind: 'ok'; productsCount: number; source: string; durationMs: number }
  | {
      kind: 'partial';
      productsCount: number;
      expected: number;
      source: string;
      reason: string;
    }
  | { kind: 'failed'; source: string; reason: string };

export type CatalogSyncInput = {
  merchantId: string;
  domain: string;
  platform: schema.PlatformValue;
  adapterType: schema.AdapterType;
  // optional injection for tests
  fetchCatalog?: (domain: string) => Promise<CatalogClientResult>;
};

function pickClient(
  platform: schema.PlatformValue,
  adapterType: schema.AdapterType,
): { source: string; fetch: (domain: string) => Promise<CatalogClientResult> } {
  switch (adapterType) {
    case 'shopify':
      return {
        source: 'shopify_storefront',
        fetch: (d) => fetchShopifyCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    case 'woo':
      return {
        source: 'woo_store_api',
        fetch: (d) => fetchWooCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    case 'magento':
      return {
        source: 'magento_rest',
        fetch: (d) => fetchMagentoCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    case 'bigcommerce':
      return {
        source: 'bigcommerce_storefront',
        fetch: (d) => fetchBigCommerceCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    case 'wix':
      return {
        source: 'wix_stores',
        fetch: (d) => fetchWixCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    case 'squarespace':
      return {
        source: 'squarespace_commerce',
        fetch: (d) => fetchSquarespaceCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
      };
    default:
      // 'dom' / 'suggest' / null fall back to DOM crawl (existing behaviour for custom).
      // Platform check kept in place to preserve the prior fallback for custom sites
      // even when adapterType is null.
      if (platform !== 'shopify' && platform !== 'woocommerce') {
        return {
          source: 'dom_crawl',
          fetch: (d) => fetchDomCatalog(d, { cap: 500, timeoutMs: 90_000 }),
        };
      }
      return {
        source: 'dom_crawl',
        fetch: (d) => fetchDomCatalog(d, { cap: 500, timeoutMs: 90_000 }),
      };
  }
}

async function writeProducts(merchantId: string, products: NormalizedProduct[]): Promise<void> {
  if (products.length === 0) return;
  // Wipe + replace — onboarding is the initial sync; daily recrawl is Phase 2.
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.insert(schema.products).values(
    products.map((p) => ({
      merchantId,
      sku: p.sku,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      variants: p.variants,
      priceCents: p.priceCents,
      currency: p.currency,
      inStock: p.inStock,
      source: p.source,
      sourceMeta: p.sourceMeta ?? null,
    })),
  );
}

export async function catalogSync(input: CatalogSyncInput): Promise<CatalogSyncResult> {
  const start = Date.now();
  const { source, fetch } = pickClient(input.platform, input.adapterType);
  const fetchFn = input.fetchCatalog ?? fetch;
  log.info({ merchantId: input.merchantId, domain: input.domain, source }, 'catalog sync start');

  const result = await fetchFn(input.domain);
  if (result.kind === 'failed') {
    return { kind: 'failed', source, reason: result.reason };
  }

  await writeProducts(input.merchantId, result.products);
  await db
    .update(schema.merchants)
    .set({ catalogSyncedAt: new Date(), lastIndexedAt: new Date() })
    .where(eq(schema.merchants.id, input.merchantId));

  const ratio = result.expected > 0 ? result.products.length / result.expected : 1;
  const durationMs = Date.now() - start;
  if (ratio < PARTIAL_THRESHOLD) {
    return {
      kind: 'partial',
      productsCount: result.products.length,
      expected: result.expected,
      source,
      reason: `ratio_${ratio.toFixed(2)}`,
    };
  }
  return { kind: 'ok', productsCount: result.products.length, source, durationMs };
}
