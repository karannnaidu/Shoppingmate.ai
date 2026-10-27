export type GeminiTransportEvent =
  // Visitor's words, finalized at end of turn (server-side ASR via inputAudioTranscription).
  // continues: carries on after a short pause (merge with the previous piece);
  // viaQuiet: flushed because the visitor went quiet (Olivia hasn't started).
  | { type: 'final_transcript'; text: string; continues?: boolean; viaQuiet?: boolean }
  // Bot's words, accumulated running transcript while the turn is in progress.
  // Emitted per outputAudioTranscription chunk so the widget can render captions
  // in lock-step with Sage's audio instead of dumping a wall of text at the end.
  // The visitor went quiet for a moment (audio cue only — never an action).
  | { type: 'visitor_paused' }
  | { type: 'bot_text_partial'; text: string }
  // Bot's words, finalized at end of turn (server-side captioning of model output).
  | { type: 'bot_text'; text: string }
  | { type: 'audio_out'; bytes: Uint8Array }
  | { type: 'speech_started' }
  | { type: 'speech_ended' }
  // Gemini Live tells us the visitor barged in (server-side VAD detected speech
  // during model output). The model stops generating but anything already
  // buffered in our local AudioSource will keep playing unless we drop it.
  | { type: 'interrupted' }
  // One-brain mode: the voice model wants to run shop tools (wire names).
  | { type: 'tool_call'; calls: { id: string; name: string; args: Record<string, unknown> }[] }
  | { type: 'tool_cancel'; ids: string[] }
  | { type: 'error'; error: Error };

export type ToolResponse = { id: string; name: string; response: Record<string, unknown> };

export type GeminiTransport = {
  open: (cfg: {
    voiceId: string;
    systemInstruction: string;
    // Called at RECONNECT time (not first open) to fetch a compact recent
    // transcript, so the fresh Gemini session resumes the conversation with
    // awareness instead of starting blank. Returns '' when there's nothing yet.
    getResumeContext?: () => string;
    /** Gemini tool declarations (one-brain mode); omitted = talk only. */
    tools?: unknown[];
  }) => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
  respondTool?: (responses: ToolResponse[]) => void;
  /** The live model currently has the shop tools (false after a fallback to 2.5). */
  toolsActive?: () => boolean;
};

export type GeminiSession = {
  open: () => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
  updateAllowedSpeechTokens: (tokens: Set<string>) => void;
  respondTool: (responses: ToolResponse[]) => void;
  toolsActive: () => boolean;
};

const NUMERIC_PRICE = /[\$€£¥₹]|\b\d/;
const NUMERIC_CHAR = /[\$€£¥₹\d]/;

export function createGeminiSession(opts: {
  transport: GeminiTransport;
  voiceId: string;
  systemInstruction: string;
  allowedSpeechTokens?: Set<string>;
  getResumeContext?: () => string;
  tools?: unknown[];
}): GeminiSession {
  const { transport, voiceId, systemInstruction, getResumeContext, tools } = opts;
  let allowed = new Set(opts.allowedSpeechTokens ?? []);
  return {
    open: () => transport.open({ voiceId, systemInstruction, getResumeContext, ...(tools ? { tools } : {}) }),
    pushAudio: (f) => transport.pushAudio(f),
    speak: async (text) => {
      if (NUMERIC_PRICE.test(text) && !isFullyCoveredByAllowed(text, allowed)) {
        throw new Error(
          `geminiSession.speak() refused numeric content (defense-in-depth on no-numeric-prices invariant): "${text}"`,
        );
      }
      await transport.speak(text);
    },
    interrupt: () => transport.interrupt(),
    close: () => transport.close(),
    onEvent: (cb) => transport.onEvent(cb),
    updateAllowedSpeechTokens: (tokens) => {
      allowed = new Set(tokens);
    },
    respondTool: (responses) => transport.respondTool?.(responses),
    toolsActive: () => transport.toolsActive?.() ?? false,
  };
}

function isFullyCoveredByAllowed(text: string, allowed: Set<string>): boolean {
  if (allowed.size === 0) return false;
  const mask = new Uint8Array(text.length);
  for (const token of allowed) {
    if (!token) continue;
    let i = 0;
    while (i <= text.length - token.length) {
      const j = text.indexOf(token, i);
      if (j < 0) break;
      for (let k = j; k < j + token.length; k++) mask[k] = 1;
      i = j + token.length;
    }
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (NUMERIC_CHAR.test(ch) && mask[i] !== 1) return false;
  }
  return true;
}
