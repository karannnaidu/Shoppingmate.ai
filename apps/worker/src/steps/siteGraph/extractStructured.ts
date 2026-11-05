import type { LinkLocation, MediaRole, PageType } from '@shoppingmate/db';
import { harvestJsonLd, looksLikePdpUrl, slugFromUrl, type LdProduct } from './jsonLd.js';

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
  product ({name, description, currency, options}) if this page sells ONE product; else null.
    description = 2-3 plain sentences on what it is and who it's for, from the page text.
    currency = ISO code (INR, USD, ...). options = array of {label, price, subscribePrice} for each pack / size / plan
    the page lists: price = its ONE-TIME total price as a number (not per-unit, not the subscription price);
    subscribePrice = the subscribe-and-save total if the page shows one, else null
    (e.g. {"label":"10-Day Ritual (10 gummies)","price":4500,"subscribePrice":4275}).

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

type LlmProduct = {
  name?: unknown;
  description?: unknown;
  currency?: unknown;
  options?: unknown;
};

const CURRENCY_BY_SYMBOL: Record<string, string> = { '₹': 'INR', Rs: 'INR', $: 'USD', '£': 'GBP', '€': 'EUR' };
const SYMBOL_BY_CURRENCY: Record<string, string> = { INR: '₹', USD: '$', GBP: '£', EUR: '€' };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8377;/g, '₹');
}

function metaContent(html: string, key: string): string | null {
  const tag = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i').exec(html)?.[0];
  // Quote-matched: content="India's …" must not stop at the apostrophe.
  const m = tag ? /content=(?:"([^"]*)"|'([^']*)')/i.exec(tag) : null;
  const v = m ? (m[1] ?? m[2]) : undefined;
  return v ? decodeEntities(v).trim() || null : null;
}

function absUrl(src: string, pageUrl: string): string | null {
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return null;
  }
}

/**
 * A product page with no Product JSON-LD (2026-11-06: Calmosis launched Holistic
 * Gummy with only Organization/WebSite JSON-LD, so a re-scan never added it to
 * the catalog and the assistant said it didn't exist). Build the product from
 * the page itself: the heading, meta description, the product's own image, and
 * the prices the reader found (LLM options first, else the first price shown).
 */
export function productFromPage(
  html: string,
  url: string,
  h1: string | null,
  llmProduct: LlmProduct | null | undefined,
): ExtractedProduct | null {
  const sku = slugFromUrl(url);
  if (!sku) return null;
  const pageH1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const docTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const firstPart = (t: string | null | undefined) => (t ? decodeEntities(t).split(/\s[—|–-]\s/)[0]?.trim() : '');
  const title =
    (typeof llmProduct?.name === 'string' && llmProduct.name.trim()) ||
    (pageH1 ? decodeEntities(pageH1) : '') ||
    h1?.trim() ||
    firstPart(metaContent(html, 'og:title')) ||
    firstPart(docTitle) ||
    null;
  if (!title) return null;

  const options = (Array.isArray(llmProduct?.options) ? (llmProduct.options as unknown[]) : [])
    .map((o) => {
      const r = (o ?? {}) as Record<string, unknown>;
      const price = typeof r.price === 'number' ? r.price : Number(String(r.price ?? '').replace(/[^\d.]/g, ''));
      const sub = typeof r.subscribePrice === 'number' ? r.subscribePrice : Number(String(r.subscribePrice ?? '').replace(/[^\d.]/g, ''));
      return { label: String(r.label ?? '').trim(), price, subscribePrice: Number.isFinite(sub) && sub > 0 && sub < price ? sub : null };
    })
    .filter((o) => o.label && Number.isFinite(o.price) && o.price > 0);

  let currency =
    typeof llmProduct?.currency === 'string' && /^[A-Z]{3}$/.test(llmProduct.currency) ? llmProduct.currency : null;
  let priceCents: number | null =
    options.length > 0 ? Math.round(Math.min(...options.map((o) => o.price)) * 100) : null;
  let pricesShown: string[] = [];
  if (priceCents === null) {
    // No LLM help. Whole-product prices after the heading, skipping per-unit
    // ones ("₹500 ₹450 / gummy"). One price → that's the price. Several (packs,
    // subscriptions) → don't guess a wrong one: leave the price empty and list
    // what the page shows so the assistant reads the page for the exact pack.
    const text = visibleText(html);
    const rest = text.slice(Math.max(0, text.indexOf(title)));
    const priceRe = /(₹|Rs\.?|\$|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
    const found: Array<{ symbol: string; amount: number; raw: string }> = [];
    for (const m of rest.matchAll(priceRe)) {
      const end = (m.index ?? 0) + m[0].length;
      const after = rest.slice(end, end + 24);
      if (/^\s*(?:(?:₹|Rs\.?|\$|£|€)\s?\d[\d,.]*\s*)?(?:\/|per\b|each\b)/i.test(after)) continue;
      const amount = Number(m[2]!.replace(/,/g, ''));
      if (!found.some((f) => f.amount === amount)) found.push({ symbol: m[1]!.replace('.', ''), amount, raw: m[0].replace(/\s+/g, '') });
      if (found.length >= 6) break;
    }
    if (found.length > 0) currency = currency ?? CURRENCY_BY_SYMBOL[found[0]!.symbol] ?? null;
    if (found.length === 1) priceCents = Math.round(found[0]!.amount * 100);
    else pricesShown = found.map((f) => f.raw);
  }

  const llmDesc = typeof llmProduct?.description === 'string' ? llmProduct.description.trim() : '';
  const metaDesc = metaContent(html, 'description') ?? metaContent(html, 'og:description') ?? '';
  const symbol = (currency && SYMBOL_BY_CURRENCY[currency]) || (currency ? `${currency} ` : '');
  const optionLine =
    options.length > 0
      ? `Options: ${options
          .map(
            (o) =>
              `${o.label} — ${symbol}${o.price.toLocaleString('en-IN')}` +
              (o.subscribePrice ? ` (${symbol}${o.subscribePrice.toLocaleString('en-IN')} on subscription)` : ''),
          )
          .join('; ')}.`
      : '';
  const pricesLine =
    pricesShown.length > 0
      ? `Several packs/prices on the page (${pricesShown.join(', ')}) — check the page for the exact pack price.`
      : '';
  const description = [llmDesc || metaDesc, optionLine || pricesLine].filter(Boolean).join(' ') || null;

  // The product's own picture: an <img> whose alt names the product, else og:image.
  let imageUrl: string | null = null;
  const lowerTitle = title.toLowerCase();
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const alt = /\balt=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
    const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && !src.startsWith('data:') && decodeEntities(alt).toLowerCase().includes(lowerTitle)) {
      imageUrl = absUrl(src, url);
      break;
    }
  }
  if (!imageUrl) {
    const og = metaContent(html, 'og:image');
    imageUrl = og ? absUrl(og, url) : null;
  }

  return {
    sku,
    title,
    description,
    imageUrl,
    priceCents,
    currency,
    inStock: null,
    brand: metaContent(html, 'og:site_name'),
    raw: { source: 'page', options },
  };
}

/** HTML for the LLM: scripts, styles, SVG, comments and presentational
 *  attributes removed. Tailwind class soup + inline JSON pushed the real page
 *  content past the 32k window on modern sites (Calmosis: title/h1 came back null). */
export function compactHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(link|meta)\b[^>]*>/gi, (tag) => (/name=["']description["']|property=["']og:/i.test(tag) ? tag : ''))
    .replace(
      /\s(class|style|data-[\w-]+|aria-[\w-]+|srcset|sizes|loading|decoding|fetchpriority|width|height|role|tabindex|target|rel)=("[^"]*"|'[^']*')/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><');
}

export async function extractStructured(args: ExtractArgs): Promise<ExtractedPage> {
  const jsonLd = harvestJsonLd(args.html, args.url);
  const isPdp = jsonLd.product !== null || looksLikePdpUrl(args.url);
  const urlType = classifyByUrl(args.url);

  const prompt = `${SYSTEM}\n\nURL: ${args.url}\n\nHTML:\n${truncateHtml(compactHtml(args.html), 32_000)}`;
  let llm: Partial<ExtractedPage> = {};
  try {
    llm = (await args.llmCall(prompt)) as Partial<ExtractedPage>;
  } catch {
    llm = {};
  }

  const llmFaqs: ExtractedFaq[] = (Array.isArray(llm.faq) ? llm.faq : []).filter(
    (f): f is ExtractedFaq => typeof f?.question === 'string' && typeof f?.answer === 'string',
  );
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
    policy: validPolicy(llm.policy) ?? (urlType === 'policy' ? policyFromHtml(args.url, args.html) : null),
    media: Array.isArray(llm.media) ? llm.media : [],
    product:
      jsonLd.product ??
      (isPdp
        ? productFromPage(
            args.html,
            args.url,
            typeof llm.h1 === 'string' ? llm.h1 : null,
            (llm as { product?: LlmProduct | null }).product,
          )
        : null),
  };
}

/** The LLM sometimes returns a policy with a null/empty body (2026-11-05: a
 *  null full_text failed the whole Calmosis re-scan). Fill the body from the
 *  summary, or drop it so the deterministic fallback runs. */
function validPolicy(p: unknown): ExtractedPolicy {
  if (!p || typeof p !== 'object') return null;
  const r = p as Record<string, unknown>;
  const policyType = (['returns', 'shipping', 'privacy', 'terms'] as const).find((t) => t === r.policyType);
  const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
  const fullText = typeof r.fullText === 'string' ? r.fullText.trim() : '';
  if (!policyType || (!summary && !fullText)) return null;
  return { policyType, summary: summary || fullText.slice(0, 700), fullText: fullText || summary };
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
