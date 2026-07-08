import type { CatalogClientResult } from './catalogClients/shopify.js';

// A storefront catalog endpoint failure that a DOM crawl can recover from:
// the JSON API is disabled/blocked (auth, hidden, not-found, rate-limited) or
// the fetch itself failed. A 5xx is the store being down — not worth a fallback.
export function catalogEndpointBlocked(reason: string): boolean {
  return /^http_(401|403|404|429)$/.test(reason) || reason === 'fetch_error';
}

// Run the primary catalog client and, if its storefront endpoint is blocked,
// fall back to a DOM crawl so the store still gets a (variant-less but usable)
// catalog instead of a hard onboarding failure. Pure/db-free for unit testing.
export async function fetchCatalogWithFallback(
  primary: (domain: string) => Promise<CatalogClientResult>,
  fallback: ((domain: string) => Promise<CatalogClientResult>) | null,
  domain: string,
): Promise<{ result: CatalogClientResult; usedFallback: boolean }> {
  const r = await primary(domain);
  if (r.kind !== 'failed' || !fallback || !catalogEndpointBlocked(r.reason)) {
    return { result: r, usedFallback: false };
  }
  const fb = await fallback(domain);
  if (fb.kind === 'failed') {
    return {
      result: { kind: 'failed', reason: `primary_${r.reason}_fallback_${fb.reason}` },
      usedFallback: true,
    };
  }
  return { result: fb, usedFallback: true };
}
