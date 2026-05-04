export type GeminiTransportEvent =
  | { type: 'partial_transcript'; text: string }
  | { type: 'final_transcript'; text: string }
  | { type: 'audio_out'; bytes: Uint8Array }
  | { type: 'speech_started' }
  | { type: 'speech_ended' }
  | { type: 'error'; error: Error };

export type GeminiTransport = {
  open: (cfg: { voiceId: string; systemInstruction: string }) => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
};

export type GeminiSession = {
  open: () => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
};

const NUMERIC_PRICE = /[\$€£¥₹]|\b\d/;

export function createGeminiSession(opts: {
  transport: GeminiTransport;
  voiceId: string;
  systemInstruction: string;
}): GeminiSession {
  const { transport, voiceId, systemInstruction } = opts;
  return {
    open: () => transport.open({ voiceId, systemInstruction }),
    pushAudio: (f) => transport.pushAudio(f),
    speak: async (text) => {
      if (NUMERIC_PRICE.test(text)) {
        throw new Error(
          `geminiSession.speak() refused numeric content (defense-in-depth on no-numeric-prices invariant): "${text}"`,
        );
      }
      await transport.speak(text);
    },
    interrupt: () => transport.interrupt(),
    close: () => transport.close(),
    onEvent: (cb) => transport.onEvent(cb),
  };
}
