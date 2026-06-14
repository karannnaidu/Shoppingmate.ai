import { describe, expect, it } from 'vitest';
import { createConversationRecorder } from './conversationRecorder.js';

describe('ConversationRecorder', () => {
  it('accumulates turns and reports counts', () => {
    const r = createConversationRecorder({ sessionId: 's1', startMs: 1000 });
    r.addTurn('user', 'hi');
    r.addTurn('agent', 'hello');
    r.addTurn('user', 'show me a calmer');
    const tags = r.finish({ mode: 'voice', nowMs: 4000 });
    expect(tags.session_id).toBe('s1');
    expect(tags.mode).toBe('voice');
    expect(tags.turns).toBe(3);
    expect(tags.duration_sec).toBe(3);
    expect(tags.outcome).toBe('abandoned');
    expect(tags.transcript).toHaveLength(3);
  });

  it('marks purchased outcome and attributed cents', () => {
    const r = createConversationRecorder({ sessionId: 's2', startMs: 0 });
    r.addTurn('user', 'buy it');
    r.markCartAdd();
    r.markCheckoutReached();
    r.markPurchased(25000);
    const tags = r.finish({ mode: 'text', nowMs: 1000 });
    expect(tags.outcome).toBe('purchased');
    expect(tags.attributed_cents).toBe(25000);
    expect(tags.cart_adds).toBe(1);
    expect(tags.checkout_reached).toBe(true);
  });

  it('ignores empty turns', () => {
    const r = createConversationRecorder({ sessionId: 's3', startMs: 0 });
    r.addTurn('user', '   ');
    const tags = r.finish({ mode: 'text', nowMs: 0 });
    expect(tags.turns).toBe(0);
  });
});
