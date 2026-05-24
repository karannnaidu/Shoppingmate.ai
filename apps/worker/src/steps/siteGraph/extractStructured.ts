import type { LinkLocation, MediaRole, PageType } from '@shoppingmate/db';

export type ExtractedIntent = { intentKey: string; selectorHint: string | null };
export type ExtractedNavLink = { anchorText: string; href: string; location: LinkLocation };
export type ExtractedFaq = { question: string; answer: string };
export type ExtractedPolicy = { policyType: 'returns' | 'shipping' | 'privacy' | 'terms'; summary: string; fullText: string } | null;
export type ExtractedMedia = { mediaUrl: string; originalAlt: string; role: MediaRole; mediaType: 'image' | 'video' | 'video_embed' };

export type ExtractedPage = {
  pageType: PageType;
  title: string | null;
  h1: string | null;
  intents: ExtractedIntent[];
  navLinks: ExtractedNavLink[];
  faq: ExtractedFaq[];
  policy: ExtractedPolicy;
  media: ExtractedMedia[];
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
  const prompt = `${SYSTEM}\n\nURL: ${args.url}\n\nHTML:\n${truncateHtml(args.html, 32_000)}`;
  try {
    const out = (await args.llmCall(prompt)) as Partial<ExtractedPage>;
    return {
      pageType: out.pageType ?? 'other',
      title: out.title ?? null,
      h1: out.h1 ?? null,
      intents: Array.isArray(out.intents) ? out.intents : [],
      navLinks: Array.isArray(out.navLinks) ? out.navLinks : [],
      faq: Array.isArray(out.faq) ? out.faq : [],
      policy: out.policy ?? null,
      media: Array.isArray(out.media) ? out.media : [],
    };
  } catch {
    return { pageType: 'other', title: null, h1: null, intents: [], navLinks: [], faq: [], policy: null, media: [] };
  }
}

function truncateHtml(html: string, maxChars: number): string {
  if (html.length <= maxChars) return html;
  return html.slice(0, maxChars) + '\n<!-- TRUNCATED -->';
}
