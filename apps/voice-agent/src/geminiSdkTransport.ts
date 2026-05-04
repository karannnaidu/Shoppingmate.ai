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

  return {
    async open({ voiceId, systemInstruction }) {
      session = await client.live.connect({
        model: env.GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
        },
        callbacks: {
          onmessage: (msg) => {
            const inputXcript = msg.serverContent?.inputTranscription?.text;
            if (inputXcript) {
              emit({ type: 'partial_transcript', text: inputXcript });
            }
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
              emit({ type: 'speech_ended' });
            }
          },
          onerror: (err: Error) => emit({ type: 'error', error: err }),
          onopen: () => log.debug('gemini live ws open'),
          onclose: () => log.info('gemini live ws closed'),
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
