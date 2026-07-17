// Decide a Shopify store's onboarding finalize outcome from where its catalog
// came from. A reachable /products.json yields real NUMERIC variant ids, so
// cart.add works and the store is fully transactional. A store whose
// /products.json is blocked falls back to a DOM crawl that has NO variant ids —
// cart mutation can't resolve a numeric variant and would silently fail, so we
// mark the store degraded and disable transactional. The bot still answers
// questions and navigates; it just won't attempt cart adds it can't complete.
export type ShopifyFinalizeOutcome = {
  status: 'live' | 'degraded';
  transactionalDisabled: boolean;
  lastError: string | null;
};

export function shopifyFinalizeOutcome(catalogSource: string): ShopifyFinalizeOutcome {
  if (catalogSource === 'shopify_storefront') {
    return { status: 'live', transactionalDisabled: false, lastError: null };
  }
  return {
    status: 'degraded',
    transactionalDisabled: true,
    lastError: 'shopify_catalog_no_variants',
  };
}
