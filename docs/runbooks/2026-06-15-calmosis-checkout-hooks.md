# Calmosis frontend hooks — bot checkout completion (SP2)

**Date:** 2026-06-15
**For:** calmosis-v1-frontend (Netlify, calmosis.com)

The shoppingmate bot can now fill the visitor's details and place the COD/prepaid
order for them — but only if the Calmosis storefront exposes two `window` hooks
(same opt-in pattern as the existing `window.__shoppingmateCartAdd__`). Until these
exist, the bot gracefully falls back to navigating the visitor to `/checkout`.

## Hook 1 — fill the checkout

```ts
window.__shoppingmateCheckoutFill__ = (details: {
  name: string;
  phone: string;        // 10 digits
  address: string;      // full delivery address (free text)
  email?: string;
  pincode?: string;
  payment: 'cod' | 'prepaid';
}): boolean | Promise<boolean> => {
  // Populate the checkout form / state from `details`. Select the COD or
  // prepaid payment method. Return true on success, false if it couldn't fill.
};
```

## Hook 2 — place the order

```ts
window.__shoppingmatePlaceOrder__ = (): boolean | Promise<boolean> => {
  // Submit the order that __shoppingmateCheckoutFill__ prepared (the existing
  // guest-checkout / COD flow). Return true once the order is placed, false on
  // failure. For 'prepaid', it's fine to hand off to the payment page and
  // return true once the order is created (pending payment).
};
```

## Contract notes

- Both hooks are **optional**. If absent, the bot navigates to `/checkout` instead — no breakage.
- The bot calls `fill` first, then **reads the whole order back to the visitor and waits for an explicit "yes"**, then calls `place`. The frontend does NOT need to add its own confirmation step.
- Return `false` (or throw) on any failure — the bot will tell the visitor it didn't go through and fall back, rather than falsely claiming the order was placed.
- After a successful COD order, the frontend should still POST `/v1/conversion` (HMAC-signed, `matchSource:'cod'`) as today so it lands in the dashboard conversions ledger.

## shoppingmate side (already shipped)

Host actions `checkout_fill` / `checkout_place`, tools `checkout.fill` / `checkout.place`
(Calmosis surface only), prompt-driven collect→fill→read-back→confirm→place, and a
`checkout.placed` metric on success. Brand-agnostic: any brand that implements the two
hooks gets the same bot checkout flow.
