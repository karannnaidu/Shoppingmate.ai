export function parseSitemap(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g);
  // Sitemaps XML-escape query strings (`&amp;`) — decode or the URL 404s.
  return Array.from(matches, (m) => m[1])
    .filter((u): u is string => Boolean(u))
    .map((u) => u.replace(/&amp;/g, '&'));
}

/** Same store whether or not the host has a leading `www.` (allbirds.com vs
 *  www.allbirds.com, mejuri.com vs www.mejuri.com). */
function bareHost(h: string): string {
  return h.toLowerCase().replace(/^www\./, '');
}

export function filterUrls(urls: string[], hostname: string): string[] {
  const out: string[] = [];
  const want = bareHost(hostname);
  for (const u of urls) {
    let parsed: URL;
    try { parsed = new URL(u); } catch { continue; }
    const host = bareHost(parsed.hostname);
    if (host !== want && !host.endsWith(`.${want}`)) continue;
    const utm = Array.from(parsed.searchParams.keys()).some((k) => k.startsWith('utm_'));
    if (utm) continue;
    const page = parsed.searchParams.get('page');
    if (page && Number(page) > 3) continue;
    out.push(u);
  }
  return out;
}

/** Pages every store needs the assistant to know, whether or not they are in
 *  the sitemap (Shopify serves policies at /policies/* and never lists them).
 *  Missing ones simply 404 and are skipped by the crawler. */
export function priorityPages(rootUrl: string): string[] {
  const o = new URL(rootUrl).origin;
  return [
    `${o}/`,
    `${o}/policies/refund-policy`,
    `${o}/policies/shipping-policy`,
    `${o}/policies/terms-of-service`,
    `${o}/policies/privacy-policy`,
    `${o}/pages/faq`,
    `${o}/pages/faqs`,
    `${o}/pages/shipping`,
    `${o}/pages/returns`,
    `${o}/pages/contact`,
    `${o}/pages/about`,
    `${o}/pages/about-us`,
    // Service businesses (restaurants, salons, clinics, agencies).
    `${o}/menu`,
    `${o}/services`,
    `${o}/book`,
    `${o}/booking`,
    `${o}/appointments`,
    `${o}/reservations`,
    `${o}/contact`,
    `${o}/contact-us`,
    `${o}/about`,
    `${o}/about-us`,
    `${o}/locations`,
    `${o}/pricing`,
    `${o}/faq`,
    `${o}/doctors`,
    `${o}/team`,
  ];
}

/** Same-site links on a page — used when a small business has no sitemap, so
 *  the crawl still reaches its menu / services / contact pages. */
export function sameSiteLinks(html: string, pageUrl: string, limit = 40): string[] {
  const base = new URL(pageUrl);
  const want = bareHost(base.hostname);
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1]!.replace(/&amp;/g, '&'), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || bareHost(u.hostname) !== want) continue;
    if (/\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|css|js)$/i.test(u.pathname)) continue;
    u.hash = '';
    out.add(u.href);
    if (out.size >= limit) break;
  }
  return [...out];
}

// Order child sitemaps so content pages come first and products last — the
// crawl is capped, and 200 product pages would otherwise crowd out the FAQ.
function childRank(url: string): number {
  if (/sitemap_pages|pages/i.test(url)) return 0;
  if (/sitemap_blogs|blog/i.test(url)) return 1;
  if (/sitemap_collections|collection/i.test(url)) return 2;
  if (/sitemap_products|product/i.test(url)) return 4;
  return 3;
}

const MAX_CHILD_SITEMAPS = 8;
const MAX_PRODUCT_PAGES = 40;

export async function fetchSitemap(rootUrl: string, fetchFn: typeof fetch = fetch): Promise<string[]> {
  const root = new URL(rootUrl);
  const get = async (url: string): Promise<string | null> => {
    try {
      const res = await fetchFn(url);
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };
  const xml = await get(`${root.origin}/sitemap.xml`);
  if (!xml) return [];
  const locs = filterUrls(parseSitemap(xml), root.hostname);
  const children = locs.filter((u) => /\.xml(\?|$)/i.test(u));
  if (children.length === 0) return locs;

  // A sitemap INDEX (Shopify, most CMSes): its <loc>s are other sitemaps, not
  // pages. Previously these .xml files were "crawled" as pages and the store's
  // real pages were never read.
  const out: string[] = locs.filter((u) => !/\.xml(\?|$)/i.test(u));
  const ordered = [...children].sort((a, b) => childRank(a) - childRank(b)).slice(0, MAX_CHILD_SITEMAPS);
  for (const child of ordered) {
    const body = await get(child);
    if (!body) continue;
    let urls = filterUrls(parseSitemap(body), root.hostname).filter((u) => !/\.xml(\?|$)/i.test(u));
    if (childRank(child) === 4) urls = urls.slice(0, MAX_PRODUCT_PAGES);
    out.push(...urls);
  }
  return out;
}
