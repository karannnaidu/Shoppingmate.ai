import { childLogger } from '@shoppingmate/shared';
import { chat } from '../../lib/openrouter.js';
import { withContext } from '../../lib/playwright.js';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.dom' });
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';
const PRODUCT_URL_REGEX = /\/(product|products|p|item|shop)\//i;
const CONCURRENCY = 4;

export type DomCrawlOpts = {
  cap: number;
  timeoutMs: number;
  // Injected so tests can mock browser + LLM. Defaults call real Playwright + Haiku.
  renderHtml?: (url: string) => Promise<string>;
  extractProduct?: (url: string, html: string) => Promise<NormalizedProduct | null>;
};

async function defaultRenderHtml(url: string): Promise<string> {
  return withContext(async (ctx) => {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      return await page.content();
    } finally {
      await page.close();
    }
  });
}

async function defaultExtractProduct(url: string, html: string): Promise<NormalizedProduct | null> {
  const truncated = html.slice(0, 60_000);
  const result = await chat({
    model: 'anthropic/claude-haiku-4-5',
    responseFormat: 'json',
    timeoutMs: 30_000,
    messages: [
      {
        role: 'system',
        content:
          'Extract product details from the HTML. Return JSON: {sku, title, description, imageUrl, priceCents, currency, inStock}. Use the URL slug as sku. If the page is not a product page, return null.',
      },
      { role: 'user', content: `URL: ${url}\n\nHTML:\n${truncated}` },
    ],
  });
  try {
    const parsed = JSON.parse(result.text);
    if (!parsed || !parsed.title) return null;
    return {
      sku: parsed.sku ?? url.split('/').filter(Boolean).pop() ?? 'unknown',
      title: parsed.title,
      description: parsed.description ?? null,
      imageUrl: parsed.imageUrl ?? null,
      productUrl: url,
      priceCents: typeof parsed.priceCents === 'number' ? parsed.priceCents : null,
      currency: parsed.currency ?? null,
      inStock: typeof parsed.inStock === 'boolean' ? parsed.inStock : null,
      variants: [],
      source: 'dom_crawl',
    };
  } catch {
    return null;
  }
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    const loc = m[1];
    if (loc) urls.push(loc.trim());
    m = re.exec(xml);
  }
  return urls;
}

async function pMap<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      out[idx] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

export async function fetchDomCatalog(
  domain: string,
  opts: DomCrawlOpts,
): Promise<CatalogClientResult> {
  const renderHtml = opts.renderHtml ?? defaultRenderHtml;
  const extract = opts.extractProduct ?? defaultExtractProduct;

  // 1. Fetch sitemap
  let sitemapXml: string;
  try {
    const res = await fetch(`https://${domain}/sitemap.xml`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/xml,text/xml,*/*' },
    });
    if (!res.ok) {
      log.warn({ domain, status: res.status }, 'sitemap missing');
      return { kind: 'failed', reason: 'no_sitemap' };
    }
    sitemapXml = await res.text();
  } catch (err) {
    log.warn({ domain, err: (err as Error).message }, 'sitemap fetch error');
    return { kind: 'failed', reason: 'no_sitemap' };
  }

  // 2. Filter to product URLs, cap
  const allUrls = parseSitemapUrls(sitemapXml);
  const productUrls = allUrls.filter((u) => PRODUCT_URL_REGEX.test(u)).slice(0, opts.cap);
  const expected = productUrls.length;
  if (expected === 0) {
    return { kind: 'ok', products: [], expected: 0 };
  }

  // 3. Render + extract in parallel (concurrency cap)
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  const results = await pMap(productUrls, CONCURRENCY, async (url) => {
    if (Date.now() >= deadline) return null;
    try {
      const html = await renderHtml(url);
      return await extract(url, html);
    } catch (err) {
      log.warn({ url, err: (err as Error).message }, 'dom crawl entry failed');
      return null;
    }
  });
  for (const r of results) if (r) products.push(r);

  return { kind: 'ok', products, expected };
}
