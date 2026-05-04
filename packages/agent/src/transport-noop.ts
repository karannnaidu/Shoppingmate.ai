import type { DomAck, DomAction, WSTransport } from '@shoppingmate/adapters';

/**
 * Drop-in WSTransport for agent-runtime dispatch when the merchant's adapter
 * does not need the dom-harness control channel (every adapter except the
 * legacy DOMAdapter call path that still uses transport.send for cart-add).
 *
 * Suggest's transport.send becomes a no-op here — the runtime emits its own
 * `cards` event from the SuggestAdapter's product result, so the legacy
 * `ui.show_message`/`ui.show_product_card` events are silently dropped.
 * Plan 3e tests still pass because they construct the adapter with a real
 * test transport.
 */
export class NoOpWSTransport implements WSTransport {
  async send(_sessionId: string, _action: DomAction): Promise<DomAck> {
    return { ok: true };
  }
}
