import { createSTT } from './stt.js';
import { createTTS } from './tts.js';
import { createVoiceModeLiveKit } from './voiceModeLiveKit.js';
import { type VoiceMode, createVoiceMode as createVoiceModeWebSpeech } from './voiceModeWebSpeech.js';

export type VoiceModeFactoryOpts = {
  stack: 'live-kit' | 'web-speech';
  livekit?: {
    wsUrl: string;
    token: string;
    roomName: string;
    onTranscriptEvent: (b: Uint8Array) => void;
  };
};

export function createVoiceModeFactory(opts: VoiceModeFactoryOpts): VoiceMode | null {
  if (opts.stack === 'web-speech') {
    return createVoiceModeWebSpeech(createSTT(), createTTS());
  }
  if (opts.stack === 'live-kit') {
    if (!opts.livekit) {
      console.warn(
        '[voiceModeFactory] live-kit stack requires livekit opts; returning null → caller falls back to chat',
      );
      return null;
    }
    return createVoiceModeLiveKit(opts.livekit);
  }
  return null;
}
