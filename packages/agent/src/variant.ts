import type { Product } from '@shoppingmate/db';

// A storefront catalog variant as normalized by the catalog-sync clients
// (see apps/worker/src/steps/catalogClients/shopify.ts). Stored in the
// products.variants jsonb column, so at the type level it reads back as
// `unknown` — these helpers are the single safe accessor.
export type CatalogVariant = {
  id: string;
  sku: string | null;
  priceCents: number | null;
  inStock: boolean | null;
  options: Record<string, string>;
};

// A compact per-variant view handed to the model so it can pick the right
// variant for a multi-variant product (size/colour) without seeing the full row.
export type ModelVariant = {
  variantId: string;
  sku: string | null;
  options: Record<string, string>;
  priceCents: number | null;
  inStock: boolean | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Safe typed read of the products.variants jsonb column (untyped as `unknown`).
 *  Returns [] for products with no variant data (e.g. DOM-crawled catalogs). */
export function readVariants(product: Pick<Product, 'variants'>): CatalogVariant[] {
  const raw = product.variants;
  if (!Array.isArray(raw)) return [];
  const out: CatalogVariant[] = [];
  for (const v of raw) {
    if (!isRecord(v)) continue;
    const id = v.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    out.push({
      id: String(id),
      sku: typeof v.sku === 'string' ? v.sku : null,
      priceCents: typeof v.priceCents === 'number' ? v.priceCents : null,
      inStock: typeof v.inStock === 'boolean' ? v.inStock : null,
      options: isRecord(v.options)
        ? Object.fromEntries(
            Object.entries(v.options).filter(
              (e): e is [string, string] => typeof e[1] === 'string',
            ),
          )
        : {},
    });
  }
  return out;
}

/** The variant id when the product has exactly one variant, else null. This is
 *  the value that becomes the model-facing top-level `variantId` for a simple
 *  (non-optioned) product, so cart.add gets a numeric id with no guessing. */
export function singleVariantId(product: Pick<Product, 'variants'>): string | null {
  const variants = readVariants(product);
  return variants.length === 1 ? (variants[0]?.id ?? null) : null;
}

/**
 * Resolve a loose reference to a concrete numeric variant id for a product.
 * Order of preference:
 *   1. ref is already a variant id (exact match) → that id
 *   2. ref matches a variant SKU (case-insensitive) → that variant
 *   3. ref names an option value ("Large", "Blue") on a variant → that variant
 *   4. single-variant product → its only variant
 *   5. otherwise the first variant (last-resort default)
 * Returns null only when the product has no variants at all.
 */
export function resolveVariant(product: Pick<Product, 'variants'>, ref?: string): string | null {
  const variants = readVariants(product);
  const first = variants[0];
  if (!first) return null;
  if (variants.length === 1) return first.id;

  const needle = (ref ?? '').trim().toLowerCase();
  if (needle) {
    const byId = variants.find((v) => v.id.toLowerCase() === needle);
    if (byId) return byId.id;
    const bySku = variants.find((v) => (v.sku ?? '').toLowerCase() === needle);
    if (bySku) return bySku.id;
    const byOption = variants.find((v) =>
      Object.values(v.options).some((val) => val.toLowerCase() === needle),
    );
    if (byOption) return byOption.id;
    const byOptionLoose = variants.find((v) =>
      Object.values(v.options).some(
        (val) => val.toLowerCase().includes(needle) || needle.includes(val.toLowerCase()),
      ),
    );
    if (byOptionLoose) return byOptionLoose.id;
  }
  // Multi-variant with no usable hint: default to the first variant. Callers
  // that need option disambiguation should pass a ref.
  return first.id;
}

/**
 * Additively shape a catalog product row for the model: keep every field the
 * model already relies on (sku, title, price, urls…) and ADD an explicit
 * top-level `variantId` plus, for multi-variant products, a compact `variants`
 * list to choose from. The heavy/raw fields (searchVector, sourceMeta) are
 * dropped to keep the tool result lean.
 *
 * - Single-variant product → `variantId` set, no `variants` list.
 * - Multi-variant product  → `variantId` null, `variants` list present.
 * - No variants (Calmosis / DOM catalog) → `variantId` null; the model still
 *   has `sku`, exactly as before, so Calmosis behaviour is unchanged.
 */
export function shapeProductForModel(product: Product): Record<string, unknown> {
  const variants = readVariants(product);
  const multi = variants.length > 1;
  const modelVariants: ModelVariant[] = variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    options: v.options,
    priceCents: v.priceCents,
    inStock: v.inStock,
  }));
  return {
    sku: product.sku,
    title: product.title,
    description: product.description ?? null,
    imageUrl: product.imageUrl ?? null,
    productUrl: product.productUrl,
    priceCents: product.priceCents ?? null,
    currency: product.currency ?? null,
    inStock: product.inStock ?? null,
    variantId: variants.length === 1 ? (variants[0]?.id ?? null) : null,
    ...(multi ? { variants: modelVariants } : {}),
  };
}
