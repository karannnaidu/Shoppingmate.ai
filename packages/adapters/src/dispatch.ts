import type { Merchant } from '@shoppingmate/db';
import { BigCommerceAdapter } from './bigcommerce.js';
import { DOMAdapter } from './dom/index.js';
import type { SessionState } from './dom/sessionState.js';
import type { WSTransport } from './dom/transport.js';
import { MagentoAdapter } from './magento.js';
import { ShopifyAdapter } from './shopify.js';
import { SquarespaceAdapter } from './squarespace.js';
import { SuggestAdapter } from './suggest.js';
import type { Adapter } from './types.js';
import { WixAdapter } from './wix.js';
import { WooAdapter } from './woo.js';

/**
 * Optional injection for DOM and Suggest merchants. The transport + session
 * state are provided by the caller (apps/api widget WS for production;
 * FakeWSTransport + InMemorySessionState in tests; Playwright harness in the
 * smoke CLI).
 */
export type DispatchDeps = {
  transport: WSTransport;
  state: SessionState;
  llmCall?: (prompt: string) => Promise<string>;
};

function assertNever(x: never): never {
  throw new Error(`Unhandled adapter type: ${String(x)}`);
}

export function getAdapter(merchant: Merchant, deps?: DispatchDeps): Adapter {
  const t = merchant.adapterType;
  switch (t) {
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
      if (!deps) throw new Error('suggest_adapter_requires_transport');
      return new SuggestAdapter(deps.transport);
    case null:
    case undefined:
      throw new Error('adapter_type_missing');
    default:
      return assertNever(t);
  }
}
