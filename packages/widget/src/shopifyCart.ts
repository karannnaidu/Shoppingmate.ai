import type { HostActionResult } from './host/actions.js';

export async function injectShopifyCartAttribute(args: {
  visitorId: string;
  platform: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  if (args.platform !== 'shopify') return;
  const fetchFn = args.fetchFn ?? fetch;
  try {
    await fetchFn('/cart/update.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { sm_visitor_id: args.visitorId } }),
    });
  } catch {
    /* best-effort */
  }
}

// ── Shopify Cart bridge ──────────────────────────────────────────────────────
// Drive the REAL Shopify cart from the widget via the storefront Cart AJAX API
// (same-origin, the shopper's own session). This is the Shopify equivalent of
// Calmosis's window.__shoppingmate*__ hooks — but it needs NO storefront code:
// every Shopify theme exposes /cart/*.js. Every mutation is VERIFY-AFTER-WRITE
// (re-read /cart.js) so we never claim success the cart didn't actually take —
// the same honesty guarantee we enforce elsewhere.
//
// NOTE: Cart AJAX keys items by numeric VARIANT id, not SKU. The caller passes a
// resolved variant id (the worker resolves a product reference → variantId from
// the synced catalog before dispatching). A non-numeric ref → not_found.

type ShopifyCartLine = { id: number; quantity: number; product_title?: string; variant_title?: string };
type ShopifyCart = { item_count: number; items: ShopifyCartLine[]; total_price: number };

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function variantNumber(ref: string): number | null {
  const n = Number(String(ref).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readCart(fetchFn: typeof fetch): Promise<ShopifyCart | null> {
  try {
    const res = await fetchFn('/cart.js', { credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as ShopifyCart;
  } catch {
    return null;
  }
}

function cartToValues(cart: ShopifyCart): Record<string, string> {
  const items = (cart.items ?? [])
    .map((i) => `${i.product_title ?? 'item'}${i.variant_title ? ` ${i.variant_title}` : ''} x${i.quantity}`)
    .join(', ');
  return {
    count: String(cart.item_count ?? 0),
    items,
    subtotal: cart.total_price != null ? (cart.total_price / 100).toFixed(2) : '',
  };
}

export async function shopifyCartAdd(
  ref: string,
  qty: number,
  fetchFn: typeof fetch = fetch,
): Promise<HostActionResult> {
  const id = variantNumber(ref);
  if (id == null) return { ok: false, reason: 'not_found' };
  try {
    const res = await fetchFn('/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id, quantity: qty > 0 ? qty : 1 }),
    });
    if (!res.ok) return { ok: false, reason: 'not_found' }; // 422 = sold out / bad variant
    // Verify-after: the variant is really in the cart now.
    const cart = await readCart(fetchFn);
    if (cart && cart.items.some((i) => i.id === id)) return { ok: true, values: cartToValues(cart) };
    return { ok: false, reason: 'not_found' };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

export async function shopifyCartGet(fetchFn: typeof fetch = fetch): Promise<HostActionResult> {
  const cart = await readCart(fetchFn);
  if (!cart) return { ok: false, reason: 'not_found' };
  return { ok: true, values: cartToValues(cart) };
}

export async function shopifyCartSetQty(
  ref: string,
  qty: number,
  fetchFn: typeof fetch = fetch,
): Promise<HostActionResult> {
  const id = variantNumber(ref);
  if (id == null) return { ok: false, reason: 'not_found' };
  try {
    const res = await fetchFn('/cart/change.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id, quantity: Math.max(0, qty) }),
    });
    if (!res.ok) return { ok: false, reason: 'not_found' };
    const cart = (await res.json().catch(() => null)) as ShopifyCart | null;
    return cart ? { ok: true, values: cartToValues(cart) } : { ok: true };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

export async function shopifyCartClear(fetchFn: typeof fetch = fetch): Promise<HostActionResult> {
  try {
    const res = await fetchFn('/cart/clear.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: JSON_HEADERS,
    });
    return res.ok ? { ok: true } : { ok: false, reason: 'not_found' };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

// Shopify applies discount codes at checkout; hitting /discount/{code} stores it
// in the session (carried to native checkout). Best-effort — never blocks.
export async function shopifyApplyCoupon(
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<HostActionResult> {
  const c = String(code ?? '').trim();
  if (!c) return { ok: false, reason: 'not_found' };
  try {
    const res = await fetchFn(`/discount/${encodeURIComponent(c)}`, {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'manual',
    });
    // Any non-network response means Shopify accepted the discount link.
    return res ? { ok: true } : { ok: false, reason: 'not_found' };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}
