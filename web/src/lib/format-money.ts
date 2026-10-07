/** Whole-unit money in the store's own currency: ₹12,400 · $1,240 · €310. */
export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${Math.round(cents / 100).toLocaleString()}`;
  }
}
