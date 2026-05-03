import type { Redis } from 'ioredis';
import type { AnthropicMessage, Mode, SessionState } from './types.js';

export const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h

const keyOf = (sessionId: string) => `session:${sessionId}`;

export function createSession(opts: {
  sessionId: string;
  merchantId: string;
  mode: Mode;
  nowMs: number;
}): SessionState {
  return {
    sessionId: opts.sessionId,
    merchantId: opts.merchantId,
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: opts.nowMs,
    lastTurnAt: opts.nowMs,
    mode: opts.mode,
  };
}

export async function loadSession(redis: Redis, sessionId: string): Promise<SessionState | null> {
  const raw = await redis.get(keyOf(sessionId));
  if (!raw) return null;
  return JSON.parse(raw) as SessionState;
}

export async function saveSession(redis: Redis, session: SessionState): Promise<void> {
  await redis.set(keyOf(session.sessionId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
}

export async function deleteSession(redis: Redis, sessionId: string): Promise<void> {
  await redis.del(keyOf(sessionId));
}

export const TOKEN_BUDGET = 8_000; // 8K tokens — leaves 192K headroom on a 200K-context model
const CHARS_PER_TOKEN_APPROX = 4;

function approxTokens(m: AnthropicMessage): number {
  const c = (m as { content?: unknown }).content;
  if (typeof c === 'string') return Math.ceil(c.length / CHARS_PER_TOKEN_APPROX);
  if (c == null) return 8; // tool-call message overhead
  return Math.ceil(JSON.stringify(c).length / CHARS_PER_TOKEN_APPROX);
}

export function truncateHistory(history: AnthropicMessage[]): AnthropicMessage[] {
  let total = history.reduce((sum, m) => sum + approxTokens(m), 0);
  if (total <= TOKEN_BUDGET) return history;
  const kept = [...history];
  while (kept.length > 0 && total > TOKEN_BUDGET) {
    const dropped = kept.shift();
    if (dropped) total -= approxTokens(dropped);
  }
  return kept;
}
