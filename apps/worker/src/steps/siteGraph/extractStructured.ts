import type { LinkLocation, MediaRole, PageType } from '@shoppingmate/db';
import { harvestJsonLd, looksLikePdpUrl, type LdProduct } from './jsonLd.js';

export type ExtractedIntent = { intentKey: string; selectorHint: string | null };
export type ExtractedNavLink = { anchorText: string; href: string; location: LinkLocation };
export type ExtractedFaq = { question: string; answer: string };
export type ExtractedPolicy = { policyType: 'returns' | 'shipping' | 'privacy' | 'terms'; summary: string; fullText: string } | null;
export type ExtractedMedia = { mediaUrl: string; originalAlt: string; role: MediaRole; mediaType: 'image' | 'video' | 'video_embed' };
export type ExtractedProduct = LdProduct;

export type ExtractedPage = {
  pageType: PageType;
  title: string | null;
  h1: string | null;
  intents: ExtractedIntent[];
  navLinks: ExtractedNavLink[];
  faq: ExtractedFaq[];
  policy: ExtractedPolicy;
  media: ExtractedMedia[];
  product: ExtractedProduct | null;
};

export type ExtractArgs = {
  html: string;
  url: string;
  llmCall: (prompt: string) => Promise<unknown>;
};

const SYSTEM = `You are a structured extractor. Given a raw HTML page from an e-commerce site, return a JSON object with the keys:
  pageType (one of: home|pdp|plp|collection|policy|faq|other)
  title (string|null)
  h1 (string|null)
  intents (array of {intentKey, selectorHint}) — short human-readable label for each clearly clickable element on the page (nav links, buttons, product cards)
  navLinks (array of {anchorText, href, location}) — links in header|footer|body|breadcrumb
  faq (array of {question, answer}) if this is a FAQ page; else []
  policy ({policyType, summary, fullText}) if this is a returns/shipping/privacy/terms page; else null
  media (array of {mediaUrl, originalAlt, role, mediaType}) — for each <img>/<video>; role one of hero|product|decorative|background|icon

Return ONLY raw JSON. No prose, no markdown.`;

// Deterministic page typing from the URL path — layered UNDER the PDP check but
// OVER the LLM, so common page roles (home, policy, faq, listing) stop landing
// in "other" when the LLM is unsure. Returns null when the URL gives no signal.
export function classifyByUrl(url: string): PageType | null {
  let path: string;
  try {
    path = new URL(url).pathname.replace(/\/+$/, '').toLowerCase();
  } catch {
    return null;
  }
  if (path === '' || path === '/') return 'home';
  if (/(^|\/)(legal|policy|policies)(\/|$)|(^|\/)(terms|privacy|shipping|refund|returns?|cancellation)(\/|$)/.test(path)) {
    return 'policy';
  }
  if (/(^|\/)faqs?(\/|$)/.test(path)) return 'faq';
  // Listing pages: /shop, /collections, /products, /category (exactly — a deeper
  // path like /shop/peace-mantra is a PDP and is handled by the isPdp check first).
  if (/^\/(shop|collections?|products?|category|categories|store|catalog)$/.test(path)) return 'plp';
  return null;
}

/** Readable text of a page: the Shopify policy body when present, else the
 *  page minus scripts/styles/nav/header/footer, tags stripped, whitespace collapsed. */
export function visibleText(html: string): string {
  const body = /class="[^"]*shopify-policy__body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(html)?.[1] ?? html;
  return body
    .replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Deterministic policy from a policy URL + its HTML (no LLM). */
export function policyFromHtml(url: string, html: string): ExtractedPolicy {
  const path = url.toLowerCase();
  const policyType = /refund|return|exchange|cancel/.test(path)
    ? 'returns'
    : /shipping|delivery/.test(path)
      ? 'shipping'
      : /privacy/.test(path)
        ? 'privacy'
        : /terms|conditions|legal/.test(path)
          ? 'terms'
          : null;
  if (!policyType) return null;
  const text = visibleText(html);
  if (text.length < 80) return null;
  const summary = text.replace(/\n+/g, ' ').slice(0, 700).replace(/\s\S*$/, '') + (text.length > 700 ? '…' : '');
  return { policyType, summary, fullText: text.slice(0, 20_000) };
}

export async function extractStructured(args: ExtractArgs): Promise<ExtractedPage> {
  const jsonLd = harvestJsonLd(args.html, args.url);
  const isPdp = jsonLd.product !== null || looksLikePdpUrl(args.url);
  const urlType = classifyByUrl(args.url);

  const prompt = `${SYSTEM}\n\nURL: ${args.url}\n\nHTML:\n${truncateHtml(args.html, 32_000)}`;
  let llm: Partial<ExtractedPage> = {};
  try {
    llm = (await args.llmCall(prompt)) as Partial<ExtractedPage>;
  } catch {
    llm = {};
  }

  const llmFaqs: ExtractedFaq[] = Array.isArray(llm.faq) ? llm.faq : [];
  const mergedFaqs = mergeFaqs(jsonLd.faqs, llmFaqs);

  return {
    // Priority: PDP (JSON-LD/URL) → deterministic URL type → LLM → other.
    pageType: isPdp ? 'pdp' : (urlType ?? llm.pageType ?? 'other'),
    title: llm.title ?? jsonLd.product?.title ?? null,
    h1: llm.h1 ?? jsonLd.product?.title ?? null,
    intents: Array.isArray(llm.intents) ? llm.intents : [],
    navLinks: Array.isArray(llm.navLinks) ? llm.navLinks : [],
    faq: mergedFaqs,
    // Policies answer "returns? shipping?" — never lose them to an LLM hiccup
    // (2026-10-07: the LLM outage left every store with zero policies).
    policy: llm.policy ?? (urlType === 'policy' ? policyFromHtml(args.url, args.html) : null),
    media: Array.isArray(llm.media) ? llm.media : [],
    product: jsonLd.product,
  };
}

function mergeFaqs(primary: ExtractedFaq[], secondary: ExtractedFaq[]): ExtractedFaq[] {
  const seen = new Set<string>();
  const out: ExtractedFaq[] = [];
  for (const f of [...primary, ...secondary]) {
    const key = f.question.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ question: f.question.trim(), answer: f.answer.trim() });
  }
  return out;
}

function truncateHtml(html: string, maxChars: number): string {
  if (html.length <= maxChars) return html;
  return html.slice(0, maxChars) + '\n<!-- TRUNCATED -->';
}
