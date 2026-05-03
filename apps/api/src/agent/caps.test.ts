import { describe, expect, it } from 'vitest';
import { CAP_DURATION_MS, CAP_TURNS, CAP_VOICE_MS, checkCaps } from './caps.js';

describe('checkCaps()', () => {
  const baseSession = {
    sessionId: 's',
    merchantId: 'm',
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: 0,
    lastTurnAt: 0,
    mode: 'text' as const,
  };

  it('returns ok when all counters are below limits', () => {
    expect(checkCaps(baseSession, 'text', 1_000)).toEqual({ status: 'ok' });
  });

  it('hits turns cap on the 16th user turn (turnCount before increment = 15)', () => {
    expect(checkCaps({ ...baseSession, turnCount: CAP_TURNS }, 'text', 1_000).status).toBe('cap');
  });

  it('does NOT hit cap on the 15th turn', () => {
    expect(checkCaps({ ...baseSession, turnCount: CAP_TURNS - 1 }, 'text', 1_000).status).not.toBe('cap');
  });

  it('hits voice_ms cap when voiceMs exceeds 3 minutes in voice mode', () => {
    const r = checkCaps({ ...baseSession, voiceMs: CAP_VOICE_MS + 1 }, 'voice', 1_000);
    expect(r.status).toBe('cap');
    if (r.status === 'cap') expect(r.reason).toBe('voice_ms');
  });

  it('does not enforce voice_ms cap in text mode', () => {
    expect(
      checkCaps({ ...baseSession, voiceMs: CAP_VOICE_MS + 1 }, 'text', 1_000).status,
    ).toBe('ok');
  });

  it('hits duration_ms cap when wall-clock exceeds 25 minutes', () => {
    const r = checkCaps(
      { ...baseSession, startedAt: 0 },
      'text',
      CAP_DURATION_MS + 1,
    );
    expect(r.status).toBe('cap');
    if (r.status === 'cap') expect(r.reason).toBe('duration_ms');
  });

  it('emits cap_warning at 80% of turns cap', () => {
    const r = checkCaps({ ...baseSession, turnCount: 12 }, 'text', 1_000);
    expect(r.status).toBe('warning');
    if (r.status === 'warning') {
      expect(r.reason).toBe('turns');
      expect(r.remaining).toBe(3);
    }
  });
});
