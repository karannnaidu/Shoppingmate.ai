import type { Merchant } from '@shoppingmate/db';
import { BigCommerceAdapter } from './bigcommerce.js';
import { MagentoAdapter } from './magento.js';
import { ShopifyAdapter } from './shopify.js';
import { SquarespaceAdapter } from './squarespace.js';
import type { Adapter } from './types.js';
import { WixAdapter } from './wix.js';
import { WooAdapter } from './woo.js';

export function getAdapter(merchant: Merchant): Adapter {
  switch (merchant.adapterType) {
    case 'shopify':
      return new ShopifyAdapter();
    case 'woo':
      return new WooAdapter();
    case 'magento':
      return new MagentoAdapter();
    case 'bigcommerce':
      return new BigCommerceAdapter();
    case 'wix':
      return new WixAdapter();
    case 'squarespace':
      return new SquarespaceAdapter();
    case 'dom':
    case 'suggest':
      throw new Error(`adapter_not_implemented_in_plan3c: ${merchant.adapterType}`);
    default:
      throw new Error(`adapter_unknown: ${String(merchant.adapterType)}`);
  }
}
