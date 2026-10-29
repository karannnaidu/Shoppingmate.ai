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

describe('requests for the team in voice', () => {
  it('demo voice can take meeting requests and enquiries', () => {
    const { systemInstruction } = resolveVoiceContext('sage', { name: 'shoppingmate', domain: 'shoppingmate.ai' }, { demoMode: true, customerCare: true });
    expect(systemInstruction).toMatch(/book a demo|demo meeting/i);
    expect(systemInstruction).toMatch(/enquir|inquir/i);
    expect(systemInstruction).toMatch(/SYSTEM message/);
  });
  it('every store waits for the real outcome before saying a request is logged', () => {
    const { systemInstruction } = resolveVoiceContext('sage', { name: 'Acme Dental', domain: 'acme.test' }, { customerCare: true });
    expect(systemInstruction).toMatch(/meeting|appointment|callback/i);
    expect(systemInstruction).toMatch(/SYSTEM message|tool result/i);
  });
});
