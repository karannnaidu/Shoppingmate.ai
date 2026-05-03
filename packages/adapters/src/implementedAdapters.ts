import type { AdapterType } from '@shoppingmate/db';

export const implementedAdapters: ReadonlySet<AdapterType> = new Set<AdapterType>([
  'shopify',
  'woo',
  'magento',
  'bigcommerce',
  'wix',
  'squarespace',
  'dom',
  'suggest',
]);
