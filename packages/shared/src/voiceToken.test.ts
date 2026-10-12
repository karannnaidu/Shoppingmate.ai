import { describe, expect, it } from 'vitest';
import { signVoiceToken, verifyVoiceToken, voiceWsEnabled } from './voiceToken.js';

describe('voice WebSocket token', () => {
  const claims = { sessionId: 'ws_abc123', merchantId: 'SM-2SCCLZ' };
  it('round-trips, and rejects tampering, the wrong secret and expiry', () => {
    const t = signVoiceToken(claims, 's3cret', 60, 1_000_000);
    expect(verifyVoiceToken(t, 's3cret', 1_000_000)).toEqual(claims);
    expect(verifyVoiceToken(`${t}x`, 's3cret', 1_000_000)).toBeNull();
    expect(verifyVoiceToken(t, 'other', 1_000_000)).toBeNull();
    expect(verifyVoiceToken(t, 's3cret', 1_000_000 + 61_000)).toBeNull();
    expect(verifyVoiceToken(t, '', 1_000_000)).toBeNull();
  });
  it('is switched on per merchant', () => {
    expect(voiceWsEnabled('SM-2SCCLZ', 'SM-2SCCLZ,SM-XPK2EN')).toBe(true);
    expect(voiceWsEnabled('SM-OTHER1', 'SM-2SCCLZ')).toBe(false);
    expect(voiceWsEnabled('SM-OTHER1', '*')).toBe(true);
    expect(voiceWsEnabled('SM-OTHER1', '')).toBe(false);
  });
});
