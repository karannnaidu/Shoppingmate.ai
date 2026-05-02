import type { AdapterType, Merchant, Product } from '@shoppingmate/db';

export type AdapterContext = {
  merchant: Merchant;
  cartToken: string | null;
  sessionId: string;
  fetch?: typeof globalThis.fetch;
};

export type CartLine = {
  lineId: string;
  sku: string;
  variantId: string | null;
  title: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
  imageUrl: string | null;
};

export type CartState = {
  cartToken: string;
  lines: CartLine[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  appliedCoupons: string[];
};

export type AdapterResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'platform_error'; status: number; body: string }
  | { kind: 'unsupported'; reason: string };

export interface Adapter {
  readonly kind: AdapterType;
  searchProducts(
    ctx: AdapterContext,
    query: string,
    limit?: number,
  ): Promise<AdapterResult<Product[]>>;
  getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>>;
  cartAdd(
    ctx: AdapterContext,
    sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>>;
  cartUpdate(ctx: AdapterContext, lineId: string, qty: number): Promise<AdapterResult<CartState>>;
  cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>>;
  couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>>;
  checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>>;
}
