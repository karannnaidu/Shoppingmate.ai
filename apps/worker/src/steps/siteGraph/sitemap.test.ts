import { describe, expect, it } from 'vitest';
import { fetchSitemap, priorityPages, sameSiteLinks } from './sitemap.js';

const xmlOf = (locs: string[], index = false) =>
  index
    ? `<sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`
    : `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;

function fakeFetch(map: Record<string, string>): typeof fetch {
  return (async (url: string) =>
    map[url] ? new Response(map[url], { status: 200 }) : new Response('', { status: 404 })) as unknown as typeof fetch;
}

// Segment audit 2026-10-07: Shopify stores came out with 0 crawled pages.
describe('fetchSitemap — real-world sitemap shapes', () => {
  it('follows a sitemap INDEX into its child sitemaps (Allbirds shape), pages before products', async () => {
    const urls = await fetchSitemap(
      'https://allbirds.com/',
      fakeFetch({
        'https://allbirds.com/sitemap.xml': xmlOf(
          [
            'https://www.allbirds.com/sitemap_products_1.xml?from=1&amp;to=9',
            'https://www.allbirds.com/sitemap_pages_1.xml?from=1&amp;to=9',
          ],
          true,
        ),
        'https://www.allbirds.com/sitemap_pages_1.xml?from=1&to=9': xmlOf(['https://www.allbirds.com/pages/faq']),
        'https://www.allbirds.com/sitemap_products_1.xml?from=1&to=9': xmlOf(['https://www.allbirds.com/products/wool-runner']),
      }),
    );
    expect(urls).toEqual(['https://www.allbirds.com/pages/faq', 'https://www.allbirds.com/products/wool-runner']);
  });

  it('keeps bare-domain URLs for a www store (Mejuri shape)', async () => {
    const urls = await fetchSitemap(
      'https://www.mejuri.com/',
      fakeFetch({ 'https://www.mejuri.com/sitemap.xml': xmlOf(['https://mejuri.com/world/en/products/ring']) }),
    );
    expect(urls).toEqual(['https://mejuri.com/world/en/products/ring']);
  });

  it('finds same-site links on a home page with no sitemap (service businesses)', () => {
    const html = `<a href="/menu">Menu</a><a href="https://www.cafe.example/book-a-table">Book</a>
      <a href="https://instagram.com/cafe">IG</a><a href="/logo.png">x</a><a href="#top">top</a>`;
    expect(sameSiteLinks(html, 'https://cafe.example/')).toEqual([
      'https://cafe.example/menu',
      'https://www.cafe.example/book-a-table',
    ]);
  });

  it('always seeds policy and FAQ pages Shopify never lists', () => {
    const p = priorityPages('https://shop.example/');
    expect(p).toContain('https://shop.example/policies/refund-policy');
    expect(p).toContain('https://shop.example/policies/shipping-policy');
    expect(p).toContain('https://shop.example/pages/faq');
  });
});
import { parseSitemap, filterUrls } from './sitemap.js';

describe('parseSitemap', () => {
  it('extracts <loc> entries', () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://x.com/</loc></url>
      <url><loc>https://x.com/pricing</loc></url>
    </urlset>`;
    expect(parseSitemap(xml)).toEqual(['https://x.com/', 'https://x.com/pricing']);
  });
});

describe('filterUrls', () => {
  it('drops utm + pagination beyond ?page=3 + offsite', () => {
    const urls = [
      'https://x.com/a', 'https://x.com/a?utm_source=g', 'https://x.com/b?page=2',
      'https://x.com/b?page=5', 'https://other.com/x',
    ];
    const out = filterUrls(urls, 'x.com');
    expect(out).toContain('https://x.com/a');
    expect(out).toContain('https://x.com/b?page=2');
    expect(out).not.toContain('https://x.com/a?utm_source=g');
    expect(out).not.toContain('https://x.com/b?page=5');
    expect(out).not.toContain('https://other.com/x');
  });
});
