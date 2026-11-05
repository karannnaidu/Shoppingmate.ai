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

export async function geminiExtractCall(prompt: string): Promise<unknown> {
  // 3 tries, 15s then 30s apart: flash-lite 503s ("high demand") in bursts, and
  // a page read without the LLM loses its title, links and product options.
  for (let attempt = 0; attempt < 3; attempt++) {
    await pace();
    try {
      const model = client.getGenerativeModel({ model: attempt === 2 ? FALLBACK_MODEL() : MODEL() });
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      return JSON.parse(res.response.text());
    } catch (err) {
      if (attempt < 2 && retryable(err)) {
        await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
        continue;
      }
      if (retryable(err) && process.env.OPENROUTER_API_KEY) return openRouterExtract(prompt);
      throw err;
    }
  }
  throw new Error('gemini extract: retries exhausted');
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
