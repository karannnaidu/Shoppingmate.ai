export type TranscriptRole = 'user' | 'agent' | 'tool' | 'card';
export type TranscriptTurn = { role: TranscriptRole; content: string; timestamp: number };

export type ConversationTags = {
  session_id: string;
  mode: 'voice' | 'text';
  duration_sec: number;
  turns: number;
  outcome: 'purchased' | 'abandoned';
  attributed_cents: number;
  cart_adds: number;
  checkout_reached: boolean;
  transcript: TranscriptTurn[];
};

export type ConversationRecorder = {
  addTurn: (role: TranscriptRole, content: string) => void;
  /** Read the conversation so far (both sides) without finishing — used to
   *  deterministically extract checkout details mid-call. */
  snapshot: () => TranscriptTurn[];
  markCartAdd: () => void;
  markCheckoutReached: () => void;
  markPurchased: (cents: number) => void;
  finish: (args: { mode: 'voice' | 'text'; nowMs: number }) => ConversationTags;
};

/**
 * Accumulates a conversation's turns + funnel/outcome flags so both the voice
 * worker and the text WS can emit a single `conversationCompleted` metric event
 * (with `tags.transcript`) at session end. The dashboard's conversations-repo
 * and kpi-repo already read these tags — this is the missing writer.
 *
 * `addTurn` stamps per-turn timestamps off `Date.now()`, but `finish` takes an
 * explicit `nowMs` so duration is deterministic and unit-testable.
 */
export function createConversationRecorder(args: {
  sessionId: string;
  startMs: number;
}): ConversationRecorder {
  const turns: TranscriptTurn[] = [];
  let cartAdds = 0;
  let checkoutReached = false;
  let purchased = false;
  let attributedCents = 0;

  return {
    addTurn(role, content) {
      if (!content || content.trim().length === 0) return;
      turns.push({ role, content, timestamp: Date.now() - args.startMs });
    },
    snapshot() {
      return [...turns];
    },
    markCartAdd() {
      cartAdds += 1;
    },
    markCheckoutReached() {
      checkoutReached = true;
    },
    markPurchased(cents) {
      purchased = true;
      attributedCents = Math.max(0, Math.round(cents));
    },
    finish({ mode, nowMs }) {
      return {
        session_id: args.sessionId,
        mode,
        duration_sec: Math.max(0, Math.round((nowMs - args.startMs) / 1000)),
        turns: turns.length,
        outcome: purchased ? 'purchased' : 'abandoned',
        attributed_cents: attributedCents,
        cart_adds: cartAdds,
        checkout_reached: checkoutReached,
        transcript: turns,
      };
    },
  };
}
