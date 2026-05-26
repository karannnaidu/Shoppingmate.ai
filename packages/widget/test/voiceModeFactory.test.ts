import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('createVoiceModeFactory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when stack=live-kit but no livekit opts', async () => {
    const { createVoiceModeFactory } = await import('../src/audio/voiceModeFactory.js');
    expect(createVoiceModeFactory({ stack: 'live-kit' })).toBeNull();
  });

  it('returns a Web Speech VoiceMode when stack=web-speech', async () => {
    const { createVoiceModeFactory } = await import('../src/audio/voiceModeFactory.js');
    const vm = createVoiceModeFactory({ stack: 'web-speech' });
    expect(vm).not.toBeNull();
    expect(vm?.getState()).toBe('idle');
  });

  it('returns a LiveKit VoiceMode when stack=live-kit with opts', async () => {
    const { createVoiceModeFactory } = await import('../src/audio/voiceModeFactory.js');
    const vm = createVoiceModeFactory({
      stack: 'live-kit',
      livekit: {
        sessionId: 'sid',
        wsUrl: 'wss://x',
        token: 't',
        roomName: 'r',
        onTranscriptEvent: () => {},
      },
    });
    expect(vm).not.toBeNull();
    expect(vm?.getState()).toBe('idle');
  });
});
