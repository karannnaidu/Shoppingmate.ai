import { describe, expect, it } from 'vitest';
import { parseVoiceEnv } from './env.js';

describe('parseVoiceEnv', () => {
  it('accepts a valid env block', () => {
    const out = parseVoiceEnv({
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'API_test',
      LIVEKIT_API_SECRET: 'secret_test',
      GEMINI_API_KEY: 'AIzaSy_test',
      GEMINI_LIVE_MODEL: 'gemini-2.5-flash-native-audio-latest',
    });
    expect(out.LIVEKIT_URL).toBe('wss://example.livekit.cloud');
    expect(out.GEMINI_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-latest');
  });

  it('rejects missing GEMINI_API_KEY', () => {
    expect(() =>
      parseVoiceEnv({
        LIVEKIT_URL: 'wss://example.livekit.cloud',
        LIVEKIT_API_KEY: 'API_test',
        LIVEKIT_API_SECRET: 'secret_test',
        GEMINI_LIVE_MODEL: 'gemini-2.5-flash-native-audio-latest',
      } as never),
    ).toThrow(/GEMINI_API_KEY/);
  });

  it('defaults GEMINI_LIVE_MODEL to gemini-2.5-flash-native-audio-latest when omitted', () => {
    const out = parseVoiceEnv({
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'API_test',
      LIVEKIT_API_SECRET: 'secret_test',
      GEMINI_API_KEY: 'AIzaSy_test',
    } as never);
    expect(out.GEMINI_LIVE_MODEL).toBe('gemini-2.5-flash-native-audio-latest');
  });

  it('requires LIVEKIT_URL to be a wss URL', () => {
    expect(() =>
      parseVoiceEnv({
        LIVEKIT_URL: 'http://oops',
        LIVEKIT_API_KEY: 'API_test',
        LIVEKIT_API_SECRET: 'secret_test',
        GEMINI_API_KEY: 'AIzaSy_test',
      } as never),
    ).toThrow(/wss/);
  });
});
