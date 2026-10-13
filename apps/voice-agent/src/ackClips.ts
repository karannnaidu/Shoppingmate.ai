import { GoogleGenAI, Modality } from '@google/genai';
import { childLogger } from '@shoppingmate/shared';
import type { Redis } from 'ioredis';

// Short spoken acknowledgements ("mm-hmm") in Olivia's own voice, played the
// moment the visitor pauses so the gap before her answer feels like listening,
// not dead air — and if they were only pausing mid-sentence, it reads as a
// backchannel, not an interruption. Neutral sounds only ("sure"/"got it" would
// be wrong right before a "sorry, we don't…"). Generated once per voice with
// Gemini, trimmed, cached 30 days.

const log = childLogger({ mod: 'ack-clips' });
const WORDS = ['Mm-hmm.', 'Mhm.', 'Okay.'];
const KEY = (voiceId: string) => `sm:ack:v1:${voiceId}`;
const generating = new Set<string>();

/** Cached clips for this voice (24 kHz PCM16), or [] and a background generation. */
export async function getAckClips(redis: Redis, voiceId: string): Promise<Int16Array[]> {
  try {
    const raw = await redis.get(KEY(voiceId));
    if (raw) {
      const list = JSON.parse(raw) as string[];
      return list.map((b64) => {
        const buf = Buffer.from(b64, 'base64');
        return new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      });
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'ack clip cache read failed');
  }
  if (!generating.has(voiceId)) {
    generating.add(voiceId);
    void generateAckClips(redis, voiceId).finally(() => generating.delete(voiceId));
  }
  return [];
}

/** Drop leading/trailing near-silence and cap the length. */
export function trimClip(pcm: Int16Array, maxMs = 1100): Int16Array {
  const thr = 600;
  let a = 0;
  let b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a] as number) < thr) a++;
  while (b > a && Math.abs(pcm[b] as number) < thr) b--;
  const pad = 24 * 40; // keep 40 ms either side so it doesn't click
  const start = Math.max(0, a - pad);
  const end = Math.min(pcm.length, b + pad, start + 24 * maxMs);
  const out = pcm.slice(start, end);
  // 15 ms fade in/out.
  const fade = Math.min(360, Math.floor(out.length / 4));
  for (let i = 0; i < fade; i++) {
    out[i] = Math.round((out[i] as number) * (i / fade));
    out[out.length - 1 - i] = Math.round((out[out.length - 1 - i] as number) * (i / fade));
  }
  return out;
}

async function generateAckClips(redis: Redis, voiceId: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  const clips: string[] = [];
  for (const word of WORDS) {
    try {
      const pcm = await speakOnce(ai, voiceId, word);
      if (pcm.length > 24 * 150) clips.push(Buffer.from(trimClip(pcm).buffer).toString('base64'));
    } catch (err) {
      log.warn({ err: (err as Error).message, word }, 'ack clip generation failed');
    }
  }
  if (clips.length) {
    await redis.set(KEY(voiceId), JSON.stringify(clips), 'EX', 30 * 86_400);
    log.info({ voiceId, clips: clips.length }, 'ack clips cached');
  }
}

function speakOnce(ai: GoogleGenAI, voiceId: string, word: string): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let done = false;
    const timeout = setTimeout(() => finish(new Error('ack generation timeout')), 15_000);
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try {
        session?.close();
      } catch {
        /* ignore */
      }
      if (err) return reject(err);
      const buf = Buffer.concat(chunks);
      resolve(new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - (buf.byteLength % 2))));
    };
    ai.live
      .connect({
        model: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-latest',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
          systemInstruction: {
            parts: [{ text: 'You are a voice actor. Say ONLY the exact word you are given, softly and naturally, as a listener acknowledging someone mid-conversation. No other words.' }],
          },
          thinkingConfig: { thinkingBudget: 0 },
        },
        callbacks: {
          onmessage: (m) => {
            for (const p of m.serverContent?.modelTurn?.parts ?? []) {
              if (p.inlineData?.data) chunks.push(Buffer.from(p.inlineData.data, 'base64'));
            }
            if (m.serverContent?.turnComplete) finish();
          },
          onerror: (e) => finish(new Error(String((e as { message?: string })?.message ?? e))),
          onclose: () => finish(),
        },
      })
      .then((s) => {
        session = s;
        s.sendClientContent({ turns: [{ role: 'user', parts: [{ text: word }] }] });
      }, (e) => finish(e as Error));
  });
}
