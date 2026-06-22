import { EndSensitivity, GoogleGenAI, Modality, StartSensitivity } from '@google/genai';
import { childLogger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';
import type { GeminiTransport, GeminiTransportEvent } from './geminiSession.js';

const log = childLogger({ mod: 'gemini-sdk' });

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

// When Gemini's ws closes UNEXPECTEDLY (code 1008 context-limit on a long call,
// an idle timeout while the visitor has muted, or the max session duration), the
// bot would otherwise go permanently dead: pushAudio hits a closed session and
// the worker's audio loop ends. We instead re-open a fresh session with the same
// voice + instruction so the call survives. The executor (OpenRouter side) keeps
// the full transcript, so the tool/form-fill path is unaffected — only Gemini's
// in-session conversational memory resets, hence the "already in progress, don't
// re-greet" note we prepend on reconnect.
const MAX_RECONNECTS = 3;
const HEALTHY_RESET_MS = 60_000;

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

  // Reconnect state.
  let voiceId = '';
  let baseInstruction = '';
  let getResumeContext: (() => string) | undefined;
  let intentionalClose = false;
  let reconnects = 0;
  let healthyTimer: ReturnType<typeof setTimeout> | null = null;
  const clearHealthyTimer = () => {
    if (healthyTimer) {
      clearTimeout(healthyTimer);
      healthyTimer = null;
    }
  };

  async function connect(instruction: string): Promise<void> {
    session = await client.live.connect({
      model: env.GEMINI_LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: instruction }] },
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
        // Opt-in transcripts: without these the server returns no transcripts
        // at all, so the widget never sees the visitor's words or Sage's reply
        // text. The API rejects a `languageCodes` field here, so we pass empty
        // configs and let the server auto-detect.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // VAD tuning: START sensitivity LOW so ambient chatter doesn't register
        // as the visitor speaking; END HIGH + 500ms silence so the turn still
        // commits promptly once they actually finish.
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            // START = HIGH so the bot reliably HEARS the visitor (esp. softer /
            // accented onsets) and so barge-in works DURING the bot's own speech
            // (incl. the intro) — visitor can talk over it. Was LOW (2026-06-15,
            // to dodge background voices), but that dropped words + blocked
            // barge-in; echoCancellation + noiseSuppression now handle noise.
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            // END = LOW so a brief mid-sentence pause (common in accented/slower
            // speech) doesn't prematurely end the turn and cut the visitor off.
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            // 300ms (was 20) keeps enough audio BEFORE detected speech so the
            // first word isn't clipped before the model hears it.
            prefixPaddingMs: 300,
            silenceDurationMs: 600,
          },
        },
        // Sliding-window context compression lets long conversations run without
        // hitting Gemini's session context limit (which otherwise terminates the
        // session mid-call: ws close 1008 "Operation is not implemented..."). It
        // doesn't fully prevent it on very long calls — the reconnect logic below
        // is the backstop. Gate via env to disable instantly (no redeploy) if the
        // native-audio model rejects the field.
        ...(process.env.GEMINI_CONTEXT_COMPRESSION === 'off'
          ? {}
          : { contextWindowCompression: { slidingWindow: {} } }),
      },
      callbacks: {
        onmessage: (msg) => {
          // Barge-in: when the visitor talks over Sage, the server VAD flags the
          // turn interrupted and stops generating. Surface it so the bridge can
          // flush any locally-buffered bot audio.
          if (msg.serverContent?.interrupted) {
            emit({ type: 'interrupted' });
          }
          const inputXcript = msg.serverContent?.inputTranscription?.text;
          if (inputXcript) inputBuf += inputXcript;
          const outputXcript = msg.serverContent?.outputTranscription?.text;
          if (outputXcript) {
            outputBuf += outputXcript;
            // Stream the running bot transcript so the widget caption keeps sync
            // with the audio instead of waiting for turnComplete.
            emit({ type: 'bot_text_partial', text: outputBuf });
          }
          // Native-audio models emit audio via modelTurn.parts[].inlineData.
          const audioPart = msg.serverContent?.modelTurn?.parts?.find(
            (p) => p.inlineData?.mimeType?.startsWith('audio/'),
          );
          if (audioPart?.inlineData?.data) {
            emit({ type: 'audio_out', bytes: Buffer.from(audioPart.inlineData.data, 'base64') });
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
        onopen: () => {
          log.info('gemini live ws open');
          // Treat the session as healthy after a quiet window and reset the
          // reconnect budget — so a long call can recover many times, while a
          // tight close→reconnect→close loop still exhausts the budget and stops.
          clearHealthyTimer();
          healthyTimer = setTimeout(() => {
            reconnects = 0;
          }, HEALTHY_RESET_MS);
        },
        onclose: (ev: unknown) => {
          const c = ev as { code?: number; reason?: string };
          log.info({ code: c?.code, reason: c?.reason }, 'gemini live ws closed');
          clearHealthyTimer();
          if (intentionalClose) return;
          session = null;
          if (reconnects >= MAX_RECONNECTS) {
            log.error({ reconnects }, 'gemini reconnect budget exhausted — giving up');
            emit({
              type: 'error',
              error: new Error('gemini session closed (reconnect budget exhausted)'),
            });
            return;
          }
          reconnects += 1;
          const delay = 250 * reconnects;
          log.info({ reconnects, delay, code: c?.code }, 'gemini reconnecting after unexpected close');
          setTimeout(() => {
            // Re-ground the fresh session with a COMPACT recent transcript (the
            // full one is what overflowed in the first place), so the bot resumes
            // mid-conversation instead of blank — but doesn't immediately re-bloat.
            let ctx = '';
            try {
              ctx = getResumeContext?.() ?? '';
            } catch {
              ctx = '';
            }
            const resumeNote = ctx
              ? `${baseInstruction}\n\nCALL IN PROGRESS — you briefly reconnected. Do NOT greet, re-introduce yourself, or restart. Here is the recent conversation so you can continue seamlessly:\n${ctx}\nContinue naturally from where you left off; if you were collecting details, pick up at the next field.`
              : `${baseInstruction}\n\n(NOTE: this call is ALREADY IN PROGRESS after a brief reconnection — do NOT greet, re-introduce yourself, or restart; just continue helping the visitor from where you left off.)`;
            connect(resumeNote).catch((err) => {
              log.error({ err }, 'gemini reconnect failed');
              emit({ type: 'error', error: err as Error });
            });
          }, delay);
        },
      },
    });
  }

  return {
    async open({ voiceId: vId, systemInstruction, getResumeContext: grc }) {
      voiceId = vId;
      baseInstruction = systemInstruction;
      getResumeContext = grc;
      intentionalClose = false;
      reconnects = 0;
      await connect(systemInstruction);
      log.info({ voiceId }, 'gemini live opened');
    },
    pushAudio(frame) {
      // During a reconnect window `session` is null. DROP frames silently rather
      // than throw — otherwise the worker's `for await` audio loop ends and the
      // mic goes dead even after the session comes back.
      if (!session) return;
      session.sendRealtimeInput({
        media: {
          data: Buffer.from(frame).toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    },
    async speak(text) {
      // Skip grounding injections while reconnecting; best-effort.
      if (!session) return;
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
    },
    interrupt() {
      // No-op on native-audio: server-side VAD handles barge-in automatically once
      // it sees the visitor's mic frames, so we don't need to signal anything.
      // Sending {turns:[],turnComplete:false} causes Gemini to spam
      // "Failed to parse client content" on every ActiveSpeakersChanged tick.
    },
    async close() {
      intentionalClose = true;
      clearHealthyTimer();
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
