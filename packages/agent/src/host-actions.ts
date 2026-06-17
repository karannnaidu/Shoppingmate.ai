export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string }
  | { type: 'point_at'; intent: string }
  | { type: 'demo_click'; intent: string }
  // Calmosis stitch: add a SKU to the real storefront cart via the host page's
  // window.__shoppingmateCartAdd__ hook, and open the cart drawer.
  | { type: 'cart_add'; sku: string; qty: number }
  | { type: 'open_cart' }
  // Calmosis stitch: set absolute quantity (qty<=0 removes) + apply a coupon.
  | { type: 'cart_set_qty'; sku: string; qty: number }
  // Calmosis stitch: empty the entire cart (window.__shoppingmateClearCart__).
  | { type: 'cart_clear' }
  | { type: 'apply_coupon'; code: string }
  // Generic DOM control: fill the live page's form fields and read back the
  // values actually present (the read-back). form_read returns current values.
  | { type: 'form_fill'; fields: Array<{ field: string; value: string }> }
  | { type: 'form_read'; fields?: string[] }
  // Brand-agnostic checkout completion (opt-in): the storefront exposes
  // window.__shoppingmateCheckoutFill__(details) and __shoppingmatePlaceOrder__().
  // The bot fills the visitor's details, reads the order back for confirmation,
  // then places it. Brands that don't expose the hooks fall back to navigate.
  | { type: 'checkout_fill'; details: CheckoutDetails }
  | { type: 'checkout_place' }
  // Ask the storefront whether the visitor is logged in AND already has a saved
  // address. ok:true → use the saved address (skip collecting details); ok:false
  // → guest path, collect details + checkout_fill first.
  | { type: 'checkout_state' };

export type CheckoutDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  payment: 'cod' | 'prepaid';
};

export type HostActionResult =
  | { ok: true; values?: Record<string, string>; filled?: Array<{ field: string; ok: boolean; value: string }> }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };

export type HostActionRequest = {
  type: 'host_action_request';
  callId: string;
  action: HostAction;
};

export type HostActionResponse = {
  type: 'host_action_result';
  callId: string;
  result: HostActionResult;
};

export type PricingQuote = {
  planId: string;
  speech: string;
  card: {
    name: string;
    priceFormatted: string;
    convCount: number | null;
  };
};
