/**
 * Per-session counters used by the DOMAdapter's action-cap and the resolver's
 * per-session LLM-call cap. Plan 4 ships a Redis-backed implementation; in
 * Plan 3d we ship only the in-memory variant for tests + dev smoke.
 */
export interface SessionState {
  incrAction(sessionId: string, scope: 'turn' | 'session'): Promise<void>;
  getActions(sessionId: string): Promise<{ thisTurn: number; thisSession: number }>;
  /** returns the post-increment count of resolver calls in this session */
  incrResolver(sessionId: string): Promise<number>;
  newTurn(sessionId: string): Promise<void>;
}

type Slot = { thisTurn: number; thisSession: number; resolverCalls: number };

export class InMemorySessionState implements SessionState {
  private map = new Map<string, Slot>();

  private slot(sid: string): Slot {
    let s = this.map.get(sid);
    if (!s) {
      s = { thisTurn: 0, thisSession: 0, resolverCalls: 0 };
      this.map.set(sid, s);
    }
    return s;
  }

  async incrAction(sid: string, _scope: 'turn' | 'session'): Promise<void> {
    const s = this.slot(sid);
    s.thisTurn++;
    s.thisSession++;
  }

  async getActions(sid: string): Promise<{ thisTurn: number; thisSession: number }> {
    const s = this.slot(sid);
    return { thisTurn: s.thisTurn, thisSession: s.thisSession };
  }

  async incrResolver(sid: string): Promise<number> {
    const s = this.slot(sid);
    return ++s.resolverCalls;
  }

  async newTurn(sid: string): Promise<void> {
    this.slot(sid).thisTurn = 0;
  }
}
