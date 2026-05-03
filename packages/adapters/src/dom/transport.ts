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
 */
export class FakeWSTransport implements WSTransport {
  private script: DomAck[] = [];

  scriptOnce(ack: DomAck): void {
    this.script.push(ack);
  }

  scriptMany(acks: DomAck[]): void {
    this.script.push(...acks);
  }

  async send(_sessionId: string, action: DomAction): Promise<DomAck> {
    const next = this.script.shift();
    if (!next) {
      throw new Error(`script_empty: ${JSON.stringify(action)}`);
    }
    return next;
  }
}
