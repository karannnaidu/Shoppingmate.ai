import type { HostAction, HostActionResult } from './actions.js';

// Shopper-facing action receipts: a small line in the chat for what the
// assistant ACTUALLY did on the page ("✓ Added Sleep Mantra to your cart"),
// built from the real result — never from what the assistant said. Failures
// read honestly ("Couldn't open checkout"). Reads (looking at the page, checking
// the cart) produce no receipt.

export type Receipt = { text: string; ok: boolean };

function titleCase(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Product name from a SKU/handle; numeric Shopify variant ids have no name. */
function itemName(ref: string): string | null {
  const r = String(ref ?? '').trim();
  if (!r || /^\d+$/.test(r)) return null;
  return titleCase(r);
}

export function pageLabel(path: string): string {
  const p = (path || '/').split(/[?#]/)[0] ?? '/';
  if (p === '/' || p === '') return 'the home page';
  if (/^\/checkout/.test(p)) return 'checkout';
  if (/^\/cart\/?$/.test(p)) return 'your cart';
  const last = p.replace(/\/+$/, '').split('/').pop() ?? '';
  return last ? `the ${titleCase(last)} page` : 'that page';
}

export function receiptFor(action: HostAction, r: HostActionResult): Receipt | null {
  switch (action.type) {
    case 'cart_add': {
      const name = itemName(action.sku);
      const what = name ? `${action.qty > 1 ? `${action.qty} × ` : ''}${name}` : 'that';
      return r.ok
        ? { text: `Added ${what} to your cart`, ok: true }
        : { text: `Couldn't add ${name ?? 'that'} to your cart`, ok: false };
    }
    case 'cart_set_qty': {
      const name = itemName(action.sku) ?? 'that item';
      if (!r.ok) return { text: `Couldn't update ${name}`, ok: false };
      return action.qty <= 0
        ? { text: `Removed ${name} from your cart`, ok: true }
        : { text: `Set ${name} to ${action.qty}`, ok: true };
    }
    case 'cart_clear':
      return r.ok
        ? { text: 'Emptied your cart', ok: true }
        : { text: "Couldn't empty your cart", ok: false };
    case 'apply_coupon':
      return r.ok
        ? { text: `Applied code ${action.code.toUpperCase()}`, ok: true }
        : { text: `Code ${action.code.toUpperCase()} didn't apply`, ok: false };
    case 'navigate':
      return r.ok
        ? { text: `Opened ${pageLabel(action.path)}`, ok: true }
        : { text: `Couldn't open ${pageLabel(action.path)}`, ok: false };
    case 'form_fill':
    case 'checkout_fill': {
      if (!r.ok)
        return { text: "Couldn't fill in your details — please type them on the page", ok: false };
      const filled = r.filled ?? [];
      const missed = filled.filter((f) => !f.ok).length;
      return missed > 0
        ? { text: 'Filled in some of your details — please check the page', ok: false }
        : { text: 'Filled in your details — please check them on the page', ok: true };
    }
    case 'checkout_place':
      return r.ok
        ? { text: 'Sent your order to the payment page', ok: true }
        : { text: "Couldn't place the order", ok: false };
    case 'click':
      if (!r.ok) return { text: "Couldn't find that on the page", ok: false };
      if (r.verified === false)
        return { text: "That tap didn't change anything — trying another way", ok: false };
      return null; // a successful tap is shown by the page itself
    default:
      return null;
  }
}
