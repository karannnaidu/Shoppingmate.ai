export type DomAction =
  | { type: 'dom.navigate'; url: string }
  | { type: 'dom.click'; selector: string }
  | { type: 'dom.fill'; selector: string; value: string }
  | { type: 'dom.read'; selector: string }
  | {
      type: 'dom.wait_for';
      selector: string;
      condition: 'present' | 'mutation';
      timeoutMs: number;
    }
  | { type: 'dom.snapshot' }
  | { type: 'ui.show_message'; text: string }
  | {
      type: 'ui.show_product_card';
      product: {
        title: string;
        imageUrl: string | null;
        priceCents: number;
        currency: string;
        productUrl: string;
      };
    };

export type DomAckFailureReason =
  | 'selector_not_found'
  | 'timeout'
  | 'navigate_blocked'
  | 'safety_blocked';

export type DomAck =
  | { ok: true; value?: string; screenshotId?: string }
  | { ok: false; reason: DomAckFailureReason; html?: string; screenshotId?: string };

export interface WSTransport {
  send(sessionId: string, action: DomAction): Promise<DomAck>;
}

/**
 * Test-only transport: enqueue scripted acks and the next `send()` returns the
 * head of the queue. Throws when the queue is empty so unit tests detect
 * unexpected adapter calls instead of hanging.
 *
 * Also records every action sent, keyed by sessionId, so SuggestAdapter and
 * adapter-smoke can assert on emitted ui.* / dom.* messages.
 */
export class FakeWSTransport implements WSTransport {
  private script: DomAck[] = [];
  private autoAck: DomAck | null = null;
  private log = new Map<string, DomAction[]>();

  scriptOnce(ack: DomAck): void {
    this.script.push(ack);
  }

  scriptMany(acks: DomAck[]): void {
    this.script.push(...acks);
  }

  /** Alias for scriptOnce; matches the SuggestAdapter test vocabulary. */
  ackNext(ack: DomAck): void {
    this.script.push(ack);
  }

  /** Auto-ack every subsequent send() with this ack until cleared. */
  ackAll(ack: DomAck): void {
    this.autoAck = ack;
  }

  /** All actions recorded for a session, in send order. */
  sent(sessionId: string): DomAction[] {
    return this.log.get(sessionId) ?? [];
  }

  async send(sessionId: string, action: DomAction): Promise<DomAck> {
    const list = this.log.get(sessionId) ?? [];
    list.push(action);
    this.log.set(sessionId, list);
    const next = this.script.shift();
    if (next) return next;
    if (this.autoAck) return this.autoAck;
    throw new Error(`script_empty: ${JSON.stringify(action)}`);
  }
}
