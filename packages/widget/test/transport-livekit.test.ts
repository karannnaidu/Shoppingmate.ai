import { beforeEach, describe, expect, it, vi } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __SHOPPINGMATE_LIVEKIT_LOADER__: (() => Promise<unknown>) | undefined;
}

describe('connectToRoom', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ = undefined;
  });

  it('rejects when livekit-client lazy-load fails', async () => {
    globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ = async () => {
      throw new Error('cdn down');
    };
    const { connectToRoom } = await import('../src/transport/livekit.js');
    await expect(connectToRoom({ wsUrl: 'wss://x', token: 't', roomName: 'r' })).rejects.toThrow(
      /cdn down|livekit/i,
    );
  });

  it('connects and returns a handle on success', async () => {
    const fakeRoom = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      localParticipant: { setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined) },
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ = async () => ({
      Room: vi.fn(() => fakeRoom),
    });
    const { connectToRoom } = await import('../src/transport/livekit.js');
    const handle = await connectToRoom({ wsUrl: 'wss://x', token: 't', roomName: 'r' });
    expect(handle.disconnect).toBeTypeOf('function');
    expect(handle.setMicEnabled).toBeTypeOf('function');
    expect(handle.onData).toBeTypeOf('function');
    expect(handle.onAgentSpeaking).toBeTypeOf('function');
    expect(fakeRoom.connect).toHaveBeenCalledWith('wss://x', 't');
  });
});
