import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { childLogger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';
import type { GeminiTransport, GeminiTransportEvent } from './geminiSession.js';

const log = childLogger({ mod: 'gemini-sdk' });

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

export function createGeminiSdkTransport(): GeminiTransport {
  const env = voiceEnv();
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let session: LiveSession | null = null;
  const listeners: ((e: GeminiTransportEvent) => void)[] = [];
  const emit = (e: GeminiTransportEvent) => {
    for (const cb of listeners) cb(e);
  };

  // Accumulate transcription chunks across a turn; flush as final on turnComplete.
  // Gemini Live streams these in small pieces and only the boundary signal tells
  // us the turn has ended.
  let inputBuf = '';
  let outputBuf = '';

  return {
    async open({ voiceId, systemInstruction }) {
      session = await client.live.connect({
        model: env.GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
          // Opt-in transcripts: without these the server returns no transcripts
          // at all, so the widget never sees the visitor's words or Sage's
          // reply text. The Gemini API rejects a `languageCodes` field here
          // (SDK throws `languageCodes parameter is not supported`), so we pass
          // empty configs and let the server auto-detect.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // VAD tuning balances two goals: don't trigger on background noise
          // (a group of friends talking near the visitor) while still ending the
          // visitor's turn quickly. START sensitivity is LOW so ambient chatter /
          // room noise does NOT register as the visitor speaking — the bot stays
          // focused on the person it's conversing with and isn't falsely
          // interrupted. END stays HIGH + 500ms silence so the turn still commits
          // promptly once the visitor actually finishes. (Was START=HIGH, which
          // made the bot over-sensitive to background voices — 2026-06-15 report.)
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              prefixPaddingMs: 20,
              silenceDurationMs: 500,
            },
          },
          // Sliding-window context compression lets long conversations run
          // without hitting Gemini's session context limit, which otherwise
          // terminates the session mid-call (observed: ws close code 1008
          // "Operation is not implemented..." right at the checkout read-back on
          // long, correction-heavy calls). Gated by env so it can be disabled
          // INSTANTLY (set GEMINI_CONTEXT_COMPRESSION=off on the service) if the
          // native-audio model rejects the field — no redeploy needed.
          ...(process.env.GEMINI_CONTEXT_COMPRESSION === 'off'
            ? {}
            : { contextWindowCompression: { slidingWindow: {} } }),
        },
        callbacks: {
          onmessage: (msg) => {
            // Barge-in: when the visitor talks over Sage, Gemini's server VAD
            // flags the turn interrupted and stops generating. Surface it so the
            // bridge can flush any bot audio still queued locally — otherwise the
            // already-buffered reply keeps playing and the bot "doesn't hear the
            // visitor out" (2026-06-15 report).
            if (msg.serverContent?.interrupted) {
              emit({ type: 'interrupted' });
            }
            const inputXcript = msg.serverContent?.inputTranscription?.text;
            if (inputXcript) inputBuf += inputXcript;
            const outputXcript = msg.serverContent?.outputTranscription?.text;
            if (outputXcript) {
              outputBuf += outputXcript;
              // Stream the running bot transcript out as each chunk arrives, so
              // the widget can keep its caption bubble in sync with the audio
              // instead of waiting for turnComplete to dump the full reply.
              emit({ type: 'bot_text_partial', text: outputBuf });
            }

            // Native-audio models emit audio via modelTurn.parts[].inlineData.
            const audioPart = msg.serverContent?.modelTurn?.parts?.find(
              (p) => p.inlineData?.mimeType?.startsWith('audio/'),
            );
            if (audioPart?.inlineData?.data) {
              emit({
                type: 'audio_out',
                bytes: Buffer.from(audioPart.inlineData.data, 'base64'),
              });
            }
            if (msg.serverContent?.turnComplete) {
              if (inputBuf.trim()) emit({ type: 'final_transcript', text: inputBuf.trim() });
              if (outputBuf.trim()) emit({ type: 'bot_text', text: outputBuf.trim() });
              inputBuf = '';
              outputBuf = '';
              emit({ type: 'speech_ended' });
            }
          },
          onerror: (err: unknown) => {
            const e = err as { error?: unknown; message?: string };
            log.error({ err: e?.error ?? err, message: e?.message }, 'gemini live ws error');
            emit({ type: 'error', error: err as Error });
          },
          onopen: () => log.info('gemini live ws open'),
          onclose: (ev: unknown) => {
            const c = ev as { code?: number; reason?: string };
            log.info({ code: c?.code, reason: c?.reason }, 'gemini live ws closed');
          },
        },
      });
      log.info({ voiceId }, 'gemini live opened');
    },
    pushAudio(frame) {
      if (!session) throw new Error('gemini session not open');
      session.sendRealtimeInput({
        media: {
          data: Buffer.from(frame).toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    },
    async speak(text) {
      if (!session) throw new Error('gemini session not open');
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
    },
    interrupt() {
      // No-op on native-audio: server-side VAD handles barge-in automatically once
      // it sees the visitor's mic frames, so we don't need to signal anything.
      // Sending {turns:[],turnComplete:false} causes Gemini to spam
      // "Failed to parse client content" on every ActiveSpeakersChanged tick.
    },
    async close() {
      if (!session) return;
      session.close();
      session = null;
      log.info('gemini session closed');
    },
    onEvent(cb) {
      listeners.push(cb);
    },
  };
}
