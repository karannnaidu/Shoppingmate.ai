import type { Merchant } from '@shoppingmate/db';
import { BigCommerceAdapter } from './bigcommerce.js';
import { DOMAdapter } from './dom/index.js';
import type { SessionState } from './dom/sessionState.js';
import type { WSTransport } from './dom/transport.js';
import { MagentoAdapter } from './magento.js';
import { ShopifyAdapter } from './shopify.js';
import { SquarespaceAdapter } from './squarespace.js';
import type { Adapter } from './types.js';
import { WixAdapter } from './wix.js';
import { WooAdapter } from './woo.js';

/**
 * Optional injection for DOM merchants. The transport + session state are
 * provided by the caller (apps/api widget WS for production; FakeWSTransport
 * + InMemorySessionState in tests; Playwright harness in the smoke CLI).
 */
export type DispatchDeps = {
  transport: WSTransport;
  state: SessionState;
  llmCall?: (prompt: string) => Promise<string>;
};

export function getAdapter(merchant: Merchant, deps?: DispatchDeps): Adapter {
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
      if (!deps) throw new Error('dom_adapter_requires_transport');
      return new DOMAdapter(deps.transport, deps.state, deps.llmCall);
    case 'suggest':
      throw new Error('adapter_not_implemented_in_plan3d: suggest');
    default:
      throw new Error(`adapter_unknown: ${String(merchant.adapterType)}`);
  }
}
