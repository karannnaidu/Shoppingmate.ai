import { describe, expect, it, vi } from 'vitest';
import { swapPersona } from './personaSwap.js';

describe('swapPersona()', () => {
  it('closes the current session and re-opens with the new voiceId + systemInstruction', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);
    const session: any = { close, open: () => open() };
    await swapPersona({
      session,
      reopen: open,
    });
    expect(close).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });
});
