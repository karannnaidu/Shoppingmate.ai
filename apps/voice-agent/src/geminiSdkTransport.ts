import { GoogleGenAI, Modality } from '@google/genai';
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
          // Opt-in: without these, the server returns no transcripts at all,
          // so the widget never sees the visitor's words or Sage's reply text.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (msg) => {
            const inputXcript = msg.serverContent?.inputTranscription?.text;
            if (inputXcript) inputBuf += inputXcript;
            const outputXcript = msg.serverContent?.outputTranscription?.text;
            if (outputXcript) outputBuf += outputXcript;

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
      if (!session) return;
      // Gemini Live: empty client content with turnComplete:false signals barge-in.
      session.sendClientContent({ turns: [], turnComplete: false });
      log.debug('gemini interrupt sent');
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
