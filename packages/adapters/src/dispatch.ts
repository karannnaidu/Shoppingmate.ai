import type { Merchant } from '@shoppingmate/db';
import { ShopifyAdapter } from './shopify.js';
import type { Adapter } from './types.js';
import { WooAdapter } from './woo.js';

export function getAdapter(merchant: Merchant): Adapter {
  switch (merchant.adapterType) {
    case 'shopify':
      return new ShopifyAdapter() as unknown as Adapter;
    case 'woo':
      return new WooAdapter() as unknown as Adapter;
    case 'magento':
    case 'bigcommerce':
    case 'wix':
    case 'squarespace':
    case 'dom':
    case 'suggest':
      throw new Error(`adapter_not_implemented_in_plan3b: ${merchant.adapterType}`);
    default:
      throw new Error(`adapter_unknown: ${String(merchant.adapterType)}`);
  }
}
