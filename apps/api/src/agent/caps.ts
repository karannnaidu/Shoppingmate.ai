import type { SessionState } from './types.js';

export const CAP_TURNS = 15;
export const CAP_VOICE_MS = 180_000;     // 3 min
export const CAP_DURATION_MS = 1_500_000; // 25 min
const WARNING_FRACTION = 0.8;

export type CapReason = 'turns' | 'voice_ms' | 'duration_ms';

export type CapStatus =
  | { status: 'ok' }
  | { status: 'warning'; reason: CapReason; remaining: number }
  | { status: 'cap'; reason: CapReason };

export function checkCaps(
  session: SessionState,
  mode: 'voice' | 'text',
  nowMs: number,
): CapStatus {
  const wallClock = nowMs - session.startedAt;

  if (session.turnCount >= CAP_TURNS) return { status: 'cap', reason: 'turns' };
  if (mode === 'voice' && session.voiceMs > CAP_VOICE_MS) {
    return { status: 'cap', reason: 'voice_ms' };
  }
  if (wallClock > CAP_DURATION_MS) return { status: 'cap', reason: 'duration_ms' };

  // Warnings (in priority order: most-imminent first)
  if (session.turnCount >= Math.floor(CAP_TURNS * WARNING_FRACTION)) {
    return { status: 'warning', reason: 'turns', remaining: CAP_TURNS - session.turnCount };
  }
  if (mode === 'voice' && session.voiceMs >= CAP_VOICE_MS * WARNING_FRACTION) {
    return {
      status: 'warning',
      reason: 'voice_ms',
      remaining: CAP_VOICE_MS - session.voiceMs,
    };
  }
  if (wallClock >= CAP_DURATION_MS * WARNING_FRACTION) {
    return { status: 'warning', reason: 'duration_ms', remaining: CAP_DURATION_MS - wallClock };
  }
  return { status: 'ok' };
}
