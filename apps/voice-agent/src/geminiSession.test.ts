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
