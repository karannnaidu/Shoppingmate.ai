import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { fetchCatalogWithFallback } from './catalogFallback.js';
import { fetchBigCommerceCatalog } from './catalogClients/bigcommerce.js';
import { fetchDomCatalog } from './catalogClients/domCrawl.js';
import { fetchMagentoCatalog } from './catalogClients/magento.js';
import { fetchShopifyCatalog } from './catalogClients/shopify.js';
import type { CatalogClientResult, NormalizedProduct } from './catalogClients/shopify.js';
import { fetchShopifyCatalogViaAdmin } from './catalogClients/shopifyAdmin.js';
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
  // Decrypted Shopify Admin API token. When present, catalog sync pulls via the
  // Admin API (works on locked/dev/coming-soon stores) with public /products.json
  // as the fallback.
  shopifyToken?: string;
  // optional injection for tests
  fetchCatalog?: (domain: string) => Promise<CatalogClientResult>;
  // optional injection for tests — the DOM-crawl fallback used when a
  // platform storefront endpoint (e.g. Shopify /products.json) is blocked.
  fetchFallbackCatalog?: (domain: string) => Promise<CatalogClientResult>;
};

function pickClient(
  platform: schema.PlatformValue,
  adapterType: schema.AdapterType,
): {
  source: string;
  fetch: (domain: string) => Promise<CatalogClientResult>;
  fallback?: (domain: string) => Promise<CatalogClientResult>;
} {
  // Shopify/Woo pull a public JSON storefront endpoint; if the merchant has it
  // disabled we degrade to a DOM crawl rather than failing onboarding outright.
  const domFallback = (d: string) => fetchDomCatalog(d, { cap: 500, timeoutMs: 90_000 });
  switch (adapterType) {
    case 'shopify':
      return {
        source: 'shopify_storefront',
        fetch: (d) => fetchShopifyCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
        fallback: domFallback,
      };
    case 'woo':
      return {
        source: 'woo_store_api',
        fetch: (d) => fetchWooCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
        fallback: domFallback,
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
  const picked = pickClient(input.platform, input.adapterType);
  let fetchFn = input.fetchCatalog ?? picked.fetch;
  let fallbackFn = input.fetchFallbackCatalog ?? picked.fallback ?? null;
  let primarySource = picked.source;
  // Existing platform fallbacks are DOM crawls (no variant ids).
  let fallbackSource = 'dom_crawl';

  // Admin-API path: with the app's OAuth token, pull the catalog via Admin
  // GraphQL — works on password-protected / dev / "coming soon" stores where
  // public /products.json returns 503. Public /products.json is the fallback;
  // both yield variant-bearing catalogs, so neither is a DOM degrade.
  if (!input.fetchCatalog && input.adapterType === 'shopify' && input.shopifyToken) {
    const token = input.shopifyToken;
    fetchFn = (d) => fetchShopifyCatalogViaAdmin(d, token, { cap: 5000, timeoutMs: 90_000 });
    fallbackFn = (d) => fetchShopifyCatalog(d, { cap: 5000, timeoutMs: 90_000 });
    primarySource = 'shopify_storefront';
    fallbackSource = 'shopify_storefront';
  }

  log.info(
    { merchantId: input.merchantId, domain: input.domain, source: primarySource },
    'catalog sync start',
  );

  const { result, usedFallback } = await fetchCatalogWithFallback(
    fetchFn,
    fallbackFn,
    input.domain,
  );
  // When the primary endpoint was blocked we used the fallback; label the source
  // accordingly (DOM crawl = no variant ids; Admin↔public = variant-bearing).
  const source = usedFallback ? fallbackSource : primarySource;
  if (usedFallback) {
    log.warn(
      { merchantId: input.merchantId, domain: input.domain, primary: picked.source },
      'catalog primary endpoint blocked — fell back to dom crawl (no variant ids)',
    );
  }
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
