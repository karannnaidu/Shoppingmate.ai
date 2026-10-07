import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// Page extraction runs ~200 calls per newly onboarded store. It used
// gemini-2.5-flash — the SAME model/quota as the chat fallback — and the key
// is on Google's free tier (20 requests/day on 2.5-flash), so extraction both
// starved the fallback and stopped after ~20 pages a day. Default to
// flash-lite (separate, larger quota; plenty for structured extraction),
// pace calls, and retry once on quota/overload.
const MODEL = () => process.env.GEMINI_EXTRACT_MODEL || 'gemini-3.5-flash-lite';
const MIN_INTERVAL_MS = () => Number(process.env.GEMINI_EXTRACT_MIN_INTERVAL_MS ?? 1500);

let nextSlot = 0;
async function pace(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function retryable(err: unknown): boolean {
  return /\b(429|503)\b|quota|overloaded|high demand/i.test(String((err as Error)?.message ?? err));
}

export async function geminiExtractCall(prompt: string): Promise<unknown> {
  const model = client.getGenerativeModel({ model: MODEL() });
  for (let attempt = 0; attempt < 2; attempt++) {
    await pace();
    try {
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      return JSON.parse(res.response.text());
    } catch (err) {
      if (attempt === 0 && retryable(err)) {
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('gemini extract: retries exhausted');
}
