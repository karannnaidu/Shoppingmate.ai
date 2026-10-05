// Nav PRD Phase 8.13a — owner language for Store Insights. Every label an owner
// sees comes from here; insights-copy.test.ts fails the build if analyst jargon
// leaks into the default views.

export const BANNED_JARGON = [
  /\bLCP\b/,
  /\bINP\b/,
  /\bCLS\b/,
  /bounce rate/i,
  /conversion rate/i,
  /\bCTR\b/,
  /\bfunnel\b/i,
  /\bsessions?\b/i,
  /\bKPI\b/,
  /\bcohort\b/i,
];

export const STEP_LABEL: Record<string, string> = {
  visit: 'Visited your store',
  collection: 'Browsed a collection',
  product: 'Looked at a product',
  add_to_cart: 'Added to cart',
  cart: 'Opened the cart',
  checkout: 'Started checkout',
  purchase: 'Bought',
};

export const PAGE_LABEL: Record<string, string> = {
  home: 'Home page',
  pdp: 'Product pages',
  plp: 'Shop pages',
  collection: 'Collection pages',
  cart: 'Cart',
  checkout: 'Checkout',
  faq: 'FAQ',
  policy: 'Policy pages',
  purchase: 'Thank-you page',
  other: 'Other pages',
};

export const FRICTION_LABEL: Record<string, string> = {
  rage: 'tapped again and again because nothing happened',
  dead: 'tapped something that does nothing',
  error: 'tapped and hit an error',
  uturn: 'left within a few seconds',
};

export const DEVICE_LABEL: Record<string, string> = { mobile: 'phones', tablet: 'tablets', desktop: 'computers' };

export function money(v: number, currency: string): string {
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : `${currency} `;
  return `${sym}${Math.round(v).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US')}`;
}

/** "out of 100 visitors, 2 bought" — never "conversion rate 2%". */
export function outOf100(rate: number): string {
  const n = Math.round(rate * 1000) / 10;
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} in 100`;
}

/** Turn a structural element key ("button/add to cart") into words. */
export function elementWords(key: string): string {
  const [role, ...rest] = key.split(/[/|]/);
  const name = rest.join(' ').trim();
  if (!name || name === '-') return 'something on the page';
  const kind = role === 'link' ? 'link' : role === 'button' ? 'button' : 'control';
  return `the “${name}” ${kind}`;
}

export function pageSpeedWords(ms: number | null): string | null {
  if (ms == null) return null;
  const s = Math.round(ms / 100) / 10;
  return s >= 4 ? `takes ${s} seconds to show — slow` : s >= 2.5 ? `takes ${s} seconds to show` : `shows in ${s} seconds`;
}

export function trendWords(now: number, before: number): { text: string; tone: 'good' | 'bad' | 'flat' } {
  if (before <= 0) return { text: 'first week we can compare', tone: 'flat' };
  const change = (now - before) / before;
  if (Math.abs(change) < 0.1) return { text: 'about the same as usual', tone: 'flat' };
  return change > 0
    ? { text: `↑ ${Math.round(change * 100)}% more than usual`, tone: 'good' }
    : { text: `↓ ${Math.round(-change * 100)}% fewer than usual`, tone: 'bad' };
}
