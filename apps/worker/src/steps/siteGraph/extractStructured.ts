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

export async function extractStructured(args: ExtractArgs): Promise<ExtractedPage> {
  const jsonLd = harvestJsonLd(args.html, args.url);
  const isPdp = jsonLd.product !== null || looksLikePdpUrl(args.url);

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
    pageType: isPdp ? 'pdp' : (llm.pageType ?? 'other'),
    title: llm.title ?? jsonLd.product?.title ?? null,
    h1: llm.h1 ?? jsonLd.product?.title ?? null,
    intents: Array.isArray(llm.intents) ? llm.intents : [],
    navLinks: Array.isArray(llm.navLinks) ? llm.navLinks : [],
    faq: mergedFaqs,
    policy: llm.policy ?? null,
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
