import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

// Admin-API catalog client. Unlike the public /products.json client, this uses
// the app's OAuth access token, so it works on password-protected, "coming
// soon", and development stores — and is robust to Shopify tightening public
// storefront endpoints. Produces the same NormalizedProduct shape (numeric
// variant ids) the rest of the pipeline expects.
const log = childLogger({ step: 'catalogSync.shopifyAdmin' });
const API_VERSION = '2026-07';
const PAGE_SIZE = 100;
// Only sellable products reach the bot: ACTIVE status (excludes DRAFT/ARCHIVED)
// and published to a sales channel (excludes hidden/unpublished). Works on
// locked stores since these are data attributes, not storefront reachability.
const CATALOG_FILTER = 'status:active AND published_status:published';

const PRODUCTS_QUERY = `#graphql
query Products($cursor: String, $size: Int!, $filter: String!) {
  shop { currencyCode }
  products(first: $size, after: $cursor, query: $filter) {
    edges {
      cursor
      node {
        handle
        title
        descriptionHtml
        onlineStoreUrl
        featuredImage { url }
        variants(first: 100) {
          edges {
            node {
              id
              sku
              price
              availableForSale
              selectedOptions { name value }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

type VariantNode = {
  id: string;
  sku: string | null;
  price: string | null;
  availableForSale: boolean | null;
  selectedOptions: Array<{ name: string; value: string }>;
};
type ProductNode = {
  handle: string;
  title: string;
  descriptionHtml: string | null;
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  variants: { edges: Array<{ node: VariantNode }> };
};
type ProductsResponse = {
  data?: {
    shop?: { currencyCode?: string };
    products?: {
      edges: Array<{ cursor: string; node: ProductNode }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

// Shopify GIDs look like gid://shopify/ProductVariant/9001 — the Cart AJAX API
// keys by the NUMERIC id, so extract the trailing digits.
function gidToNumericId(gid: string): string {
  const m = /(\d+)\s*$/.exec(gid);
  return m?.[1] ?? gid;
}
function priceToCents(price: string | null | undefined): number | null {
  if (price == null) return null;
  const n = Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || null
  );
}
function optionsFromSelected(selected: Array<{ name: string; value: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  selected.forEach((o, i) => {
    if (o.value) out[`option${i + 1}`] = o.value;
  });
  return out;
}

export async function fetchShopifyCatalogViaAdmin(
  domain: string,
  token: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let cursor: string | null = null;
  let currency = 'USD';

  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1_000, deadline - Date.now()));
    let body: ProductsResponse;
    try {
      const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: PRODUCTS_QUERY,
          variables: { cursor, size: PAGE_SIZE, filter: CATALOG_FILTER },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn({ domain, status: res.status }, 'shopify admin graphql non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      body = (await res.json()) as ProductsResponse;
    } catch (err) {
      log.warn({ domain, err: (err as Error).message }, 'shopify admin graphql fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }

    const conn = body.data?.products;
    if (!conn) return { kind: 'failed', reason: 'no_data' };
    if (body.data?.shop?.currencyCode) currency = body.data.shop.currencyCode;

    for (const edge of conn.edges) {
      if (products.length >= opts.cap) break;
      const p = edge.node;
      const variants = p.variants.edges.map((ve) => ({
        id: gidToNumericId(ve.node.id),
        sku: ve.node.sku ?? null,
        priceCents: priceToCents(ve.node.price),
        inStock: ve.node.availableForSale ?? null,
        options: optionsFromSelected(ve.node.selectedOptions ?? []),
      }));
      const first = variants[0];
      products.push({
        sku: p.handle,
        title: p.title,
        description: stripHtml(p.descriptionHtml),
        imageUrl: p.featuredImage?.url ?? null,
        productUrl: p.onlineStoreUrl ?? `https://${domain}/products/${p.handle}`,
        variants,
        priceCents: first?.priceCents ?? null,
        currency,
        inStock: variants.some((v) => v.inStock === true),
        source: 'shopify_storefront',
      });
    }

    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return { kind: 'ok', products, expected: products.length };
}
