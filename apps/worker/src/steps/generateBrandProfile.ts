import { type ChatMessage, chat } from '../lib/openrouter.js';

// A brand profile the bot uses to open warmly and stay on-topic for ANY store,
// in the same shape Calmosis already uses (merchants.brand_summary /
// brand_categories). Generated from the store's own crawled pages + product
// categories, so a new merchant needs no manual setup.
export type BrandProfile = { brandSummary: string; brandCategories: string[] };

export type BrandProfileInput = {
  brandName: string;
  domain: string;
  /** Concatenated visible text from home / about / FAQ / policy pages. */
  crawledText: string;
  /** Categories/collections/tags derived from the synced catalog. */
  productCategories?: string[];
};

// Injectable LLM call for tests — returns the raw model text for the messages.
export type BrandChatFn = (messages: ChatMessage[]) => Promise<string>;

const MODEL = 'anthropic/claude-sonnet-4-6';
const MAX_TEXT = 12_000;

const defaultChat: BrandChatFn = async (messages) => {
  const r = await chat({
    model: MODEL,
    messages,
    responseFormat: 'json',
    maxTokens: 700,
    timeoutMs: 60_000,
  });
  return r.text;
};

const BRAND_SYSTEM =
  'You write a concise brand profile for an e-commerce store, used to brief a ' +
  'shopping assistant. Reply with ONLY a JSON object of the form ' +
  '{"brand_summary": string, "brand_categories": string[]}. brand_summary is ' +
  'ONE or TWO plain sentences a store rep could say out loud about what the ' +
  'brand sells and who it is for — no marketing fluff, no prices, no claims not ' +
  'supported by the text. brand_categories is 2–6 short product-category labels. ' +
  'Use only facts present in the provided text and categories; never invent.';

function buildUserPrompt(
  brandName: string,
  domain: string,
  text: string,
  categories: string[],
): string {
  const cats = categories.length ? `\nKnown product categories: ${categories.join(', ')}.` : '';
  return `Brand: ${brandName} (${domain}).${cats}\n\nStore text:\n${text}`;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// Pull the first balanced JSON object out of a model reply, tolerating code
// fences and surrounding prose.
function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end + 1);
}

/** Parse a model reply into a BrandProfile, or null if it isn't usable. Pure. */
export function parseBrandProfile(raw: string, fallbackCategories: string[]): BrandProfile | null {
  const json = extractJson(raw);
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const summary = typeof obj.brand_summary === 'string' ? obj.brand_summary.trim() : '';
    if (!summary) return null;
    const cats = Array.isArray(obj.brand_categories)
      ? dedupe(obj.brand_categories.filter((c): c is string => typeof c === 'string'))
      : [];
    return { brandSummary: summary, brandCategories: cats.length ? cats : dedupe(fallbackCategories) };
  } catch {
    return null;
  }
}

function fallbackSummary(brandName: string, text: string): string {
  const firstSentence = text.trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 240).trim();
  return firstSentence && firstSentence.length > 20
    ? firstSentence
    : `${brandName} is an online store. Ask about products, availability, and checkout.`;
}

/**
 * Generate a brand profile from crawled store text + product categories. Never
 * throws and never returns an empty summary: on a bad/empty LLM reply it falls
 * back to a deterministic summary so onboarding is never blocked. The LLM call
 * is injectable for testing.
 */
export async function generateBrandProfile(
  input: BrandProfileInput,
  chatFn: BrandChatFn = defaultChat,
): Promise<BrandProfile> {
  const categories = dedupe(input.productCategories ?? []);
  const text = input.crawledText.slice(0, MAX_TEXT);
  const messages: ChatMessage[] = [
    { role: 'system', content: BRAND_SYSTEM },
    { role: 'user', content: buildUserPrompt(input.brandName, input.domain, text, categories) },
  ];
  let raw = '';
  try {
    raw = await chatFn(messages);
  } catch {
    raw = '';
  }
  return (
    parseBrandProfile(raw, categories) ?? {
      brandSummary: fallbackSummary(input.brandName, text),
      brandCategories: categories,
    }
  );
}
