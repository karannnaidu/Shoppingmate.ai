import type { Merchant } from '@shoppingmate/db';
import { afterEach, describe, expect, it } from 'vitest';
import { toHostAction, toolTelemetryTags } from './runtime.js';
import { buildToolSurface, isWooBridge, usesStorefrontBridge } from './tools.js';

// Nav PRD Phase 3 — platform action channels.

const names = (m: Merchant) => buildToolSurface(m).map((t) => t.function.name);
const calmosis = {
  id: 'SM-2SCCLZ',
  adapterType: 'dom',
  siteGraphEnabled: true,
} as unknown as Merchant;
const shopify = {
  id: 'M-S',
  adapterType: 'shopify',
  platform: 'shopify',
  siteGraphEnabled: true,
} as unknown as Merchant;
const woo = {
  id: 'M-W',
  adapterType: 'woocommerce',
  platform: 'woocommerce',
  siteGraphEnabled: true,
} as unknown as Merchant;

afterEach(() => {
  delete process.env.WOO_STOREFRONT_BRIDGE;
});

describe('bridge tool surfaces', () => {
  it('Calmosis + Shopify can read the REAL cart; Shopify gets live stock', () => {
    expect(names(calmosis)).toContain('cart.get');
    expect(names(shopify)).toEqual(expect.arrayContaining(['cart.get', 'products.live']));
    expect(names(calmosis)).not.toContain('products.live');
  });

  it('WooCommerce uses the storefront bridge only behind WOO_STOREFRONT_BRIDGE', () => {
    expect(isWooBridge(woo)).toBe(false);
    expect(usesStorefrontBridge(woo)).toBe(false);
    process.env.WOO_STOREFRONT_BRIDGE = '1';
    expect(usesStorefrontBridge(woo)).toBe(true);
    const n = names(woo);
    expect(n).toEqual(expect.arrayContaining(['cart.add', 'cart.update', 'cart.get']));
    expect(n.filter((x) => x === 'cart.add')).toHaveLength(1); // no adapter cart.add duplicate
  });
});

describe('channel mapping + telemetry', () => {
  it('maps cart.get and products.live to host actions', () => {
    expect(toHostAction('cart.get', {})).toEqual({ type: 'cart_get' });
    expect(toHostAction('products.live', { handle: 'classic-tee' })).toEqual({
      type: 'product_lookup',
      handle: 'classic-tee',
    });
  });

  it('tags the cart channel the widget reports', () => {
    expect(
      toolTelemetryTags(
        { ok: true, value: { ok: true, channel: 'shopify-ajax' } },
        'host',
        'cart_add',
      ),
    ).toMatchObject({ cartChannel: 'shopify-ajax' });
  });
});
