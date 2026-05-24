import { describe, expect, it } from 'vitest';
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
