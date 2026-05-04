import { describe, expect, it } from 'vitest';
import { resolveVoiceContext } from './persona.js';

describe('resolveVoiceContext', () => {
  it('returns geminiVoiceId + systemInstruction for known persona', () => {
    const ctx = resolveVoiceContext('coach');
    expect(ctx.voiceId).toBeTruthy();
    expect(ctx.systemInstruction).toMatch(/never speak numeric prices/i);
  });

  it('falls back to default persona on unknown id', () => {
    const ctx = resolveVoiceContext('does-not-exist');
    expect(ctx.voiceId).toBeTruthy();
    expect(ctx.personaId).toBe('concierge');
  });

  it('handles null/undefined persona id', () => {
    expect(resolveVoiceContext(null).voiceId).toBeTruthy();
    expect(resolveVoiceContext(undefined).voiceId).toBeTruthy();
  });
});
