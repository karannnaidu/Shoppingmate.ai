import type { HostActionResult } from './host/actions.js';

// Nav Phase 3 — WooCommerce Store API cart bridge. Drives the shopper's REAL
// cart (same origin, their session) through /wp-json/wc/store/v1/cart with the
// nonce WooCommerce hands out on any Store API response. Every mutation is
// verify-after-write: we re-read the cart before claiming success.

const BASE = '/wp-json/wc/store/v1';

type WooItem = { key: string; id: number; quantity: number; name?: string };
type WooCart = {
  items: WooItem[];
  items_count: number;
  totals?: { total_price?: string; currency_minor_unit?: number };
};

let nonce: string | null = null;

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (nonce) {
    h.Nonce = nonce;
    h['X-WC-Store-API-Nonce'] = nonce;
  }
  return h;
}

function captureNonce(res: Response): void {
  const n = res.headers.get('Nonce') ?? res.headers.get('X-WC-Store-API-Nonce');
  if (n) nonce = n;
}

async function readCart(fetchFn: typeof fetch): Promise<WooCart | null> {
  try {
    const res = await fetchFn(`${BASE}/cart`, { credentials: 'same-origin' });
    captureNonce(res);
    if (!res.ok) return null;
    return (await res.json()) as WooCart;
  } catch {
    return null;
  }
}

function toValues(cart: WooCart): Record<string, string> {
  const unit = cart.totals?.currency_minor_unit ?? 2;
  const total = cart.totals?.total_price;
  return {
    count: String(cart.items_count ?? 0),
    items: (cart.items ?? []).map((i) => `${i.name ?? 'item'} x${i.quantity}`).join(', '),
    subtotal: total != null ? (Number(total) / 10 ** unit).toFixed(unit) : '',
  };
}

function notifyTheme(): void {
  try {
    document.body.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true }));
    const jq = (window as unknown as { jQuery?: (s: unknown) => { trigger: (e: string) => void } })
      .jQuery;
    jq?.(document.body).trigger('wc_fragment_refresh');
  } catch {
    /* visual refresh only */
  }
}

function idOf(ref: string): number | null {
  const n = Number(String(ref).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function post(path: string, body: unknown, fetchFn: typeof fetch): Promise<Response> {
  if (!nonce) await readCart(fetchFn);
  const res = await fetchFn(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: headers(),
    body: JSON.stringify(body),
  });
  captureNonce(res);
  return res;
}

export async function wooCartAdd(
  ref: string,
  qty: number,
  fetchFn: typeof fetch = fetch,
): Promise<HostActionResult> {
  const id = idOf(ref);
  if (id == null) return { ok: false, reason: 'not_found' };
  try {
    const before = (await readCart(fetchFn))?.items.find((i) => i.id === id)?.quantity ?? 0;
    const res = await post('/cart/add-item', { id, quantity: qty > 0 ? qty : 1 }, fetchFn);
    if (!res.ok) return { ok: false, reason: 'not_found' };
    const cart = await readCart(fetchFn);
    const after = cart?.items.find((i) => i.id === id)?.quantity ?? 0;
    if (!cart || after <= before) return { ok: false, reason: 'not_found' };
    notifyTheme();
    return { ok: true, channel: 'woo-store-api', verified: true, values: toValues(cart) };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

export async function wooCartGet(fetchFn: typeof fetch = fetch): Promise<HostActionResult> {
  const cart = await readCart(fetchFn);
  return cart
    ? { ok: true, channel: 'woo-store-api', values: toValues(cart) }
    : { ok: false, reason: 'not_found' };
}

export async function wooCartSetQty(
  ref: string,
  qty: number,
  fetchFn: typeof fetch = fetch,
): Promise<HostActionResult> {
  const id = idOf(ref);
  if (id == null) return { ok: false, reason: 'not_found' };
  try {
    const item = (await readCart(fetchFn))?.items.find((i) => i.id === id);
    if (!item) return { ok: false, reason: 'not_found' };
    const res =
      qty <= 0
        ? await post('/cart/remove-item', { key: item.key }, fetchFn)
        : await post('/cart/update-item', { key: item.key, quantity: qty }, fetchFn);
    if (!res.ok) return { ok: false, reason: 'not_found' };
    const cart = await readCart(fetchFn);
    const now = cart?.items.find((i) => i.id === id)?.quantity ?? 0;
    if (!cart || now !== Math.max(0, qty)) return { ok: false, reason: 'not_found' };
    notifyTheme();
    return { ok: true, channel: 'woo-store-api', verified: true, values: toValues(cart) };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

export async function wooCartClear(fetchFn: typeof fetch = fetch): Promise<HostActionResult> {
  try {
    const cart = await readCart(fetchFn);
    for (const item of cart?.items ?? [])
      await post('/cart/remove-item', { key: item.key }, fetchFn);
    const after = await readCart(fetchFn);
    if (!after || after.items.length > 0) return { ok: false, reason: 'not_found' };
    notifyTheme();
    return { ok: true, channel: 'woo-store-api', verified: true, values: toValues(after) };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

/** Test hook: reset the cached nonce. */
export function resetWooNonce(): void {
  nonce = null;
}
