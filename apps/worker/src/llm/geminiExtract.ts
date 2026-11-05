import { GoogleGenerativeAI } from '@google/generative-ai';
import { simpleChat } from '@shoppingmate/shared';

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// Page extraction runs ~200 calls per newly onboarded store. It used
// gemini-2.5-flash — the SAME model/quota as the chat fallback — and the key
// is on Google's free tier (20 requests/day on 2.5-flash), so extraction both
// starved the fallback and stopped after ~20 pages a day. Default to
// flash-lite (separate, larger quota; plenty for structured extraction),
// pace calls, and retry once on quota/overload.
const MODEL = () => process.env.GEMINI_EXTRACT_MODEL || 'gemini-3.5-flash-lite';
// Last try goes to a different model: flash-lite 503s in "high demand" bursts
// (2026-11-06, the Holistic Gummy page was read with no title/links/options).
const FALLBACK_MODEL = () => process.env.GEMINI_EXTRACT_FALLBACK_MODEL || 'gemini-3.5-flash';
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

function overloaded(err: unknown): boolean {
  return /503|overloaded|high demand|unavailable/i.test(String((err as Error)?.message ?? err));
}

export async function geminiExtractCall(prompt: string): Promise<unknown> {
  // Overload (503 "high demand") comes in bursts that waiting doesn't fix:
  // switch straight to the fallback model, then OpenRouter. Quota (429) gets
  // one 15s back-off. Previously 15s+30s waits per page made a 178-page read
  // take hours (2026-11-06 Calmosis re-read).
  const models = [MODEL(), FALLBACK_MODEL()];
  let lastErr: unknown;
  for (let attempt = 0; attempt < models.length; attempt++) {
    await pace();
    try {
      const model = client.getGenerativeModel({ model: models[attempt]! });
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      return JSON.parse(res.response.text());
    } catch (err) {
      lastErr = err;
      if (!retryable(err)) throw err;
      if (!overloaded(err) && attempt === 0) await new Promise((r) => setTimeout(r, 15_000));
    }
  }
  if (process.env.OPENROUTER_API_KEY) return openRouterExtract(prompt);
  throw lastErr;
}

/** Last resort when Gemini is overloaded: the cheap OpenRouter tier. */
async function openRouterExtract(prompt: string): Promise<unknown> {
  const res = await simpleChat({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: 'json',
    maxTokens: 6000,
    timeoutMs: 90_000,
  });
  const text = res.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(text);
}
