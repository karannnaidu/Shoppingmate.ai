import { describe, expect, it, vi } from 'vitest';
import { type GeminiTransport, createGeminiSession } from './geminiSession.js';

function mockTransport(): GeminiTransport {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    pushAudio: vi.fn(),
    speak: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn(),
  };
}

describe('createGeminiSession', () => {
  it('opens with persona voice id and system instruction', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'be concise',
    });
    await s.open();
    expect(t.open).toHaveBeenCalledWith({ voiceId: 'kore', systemInstruction: 'be concise' });
  });

  it('rejects speak() when text contains numeric digits or $ (defense-in-depth)', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await expect(s.speak('That is $89.99 right now.')).rejects.toThrow(/numeric/i);
    expect(t.speak).not.toHaveBeenCalled();
  });

  it('forwards clean speak() text to transport', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await s.speak('A premium pair, around mid-range pricing on screen.');
    expect(t.speak).toHaveBeenCalledOnce();
  });

  it('interrupt() calls transport.interrupt synchronously', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    s.interrupt();
    expect(t.interrupt).toHaveBeenCalledOnce();
  });

  it('close() calls transport.close', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await s.close();
    expect(t.close).toHaveBeenCalledOnce();
  });
});

describe('createGeminiSession allow-list bypass', () => {
  it('passes through speak() text that exactly contains an allowed token', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'x',
      allowedSpeechTokens: new Set([
        'Starter is thirty dollars per month for one hundred conversations.',
      ]),
    });
    await s.open();
    await s.speak('Starter is thirty dollars per month for one hundred conversations.');
    expect(t.speak).toHaveBeenCalledOnce();
  });

  it('still rejects an LLM rephrase that contains digits/currency', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'x',
      allowedSpeechTokens: new Set([
        'Starter is thirty dollars per month for one hundred conversations.',
      ]),
    });
    await s.open();
    await expect(s.speak('Starter costs $30 a month.')).rejects.toThrow(/numeric/i);
  });

  it('updateAllowedSpeechTokens() replaces the set at runtime', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    s.updateAllowedSpeechTokens(new Set(['Growth is sixty dollars per month for five hundred conversations.']));
    await s.speak('Growth is sixty dollars per month for five hundred conversations.');
    expect(t.speak).toHaveBeenCalledOnce();
  });
});
