import { describe, expect, it, vi } from 'vitest';

// Prevent @shoppingmate/db (and its env validation) from initialising during unit tests.
// The tests pass their own fakeDb via the args, so the real db/schema is never used.
vi.mock('@shoppingmate/db', () => ({
  db: {},
  schema: { merchants: {}, siteCrawls: {}, crawlArtifacts: {} },
}));

// Prevent r2-upload from trying to build an S3Client with missing env vars.
vi.mock('../r2-upload.js', () => ({
  uploadObject: vi.fn(),
  siteGraphKey: (merchantId: string, crawlId: string, suffix: string) =>
    `${merchantId}/${crawlId}/${suffix}`,
}));

import { runCrawlSite } from './crawlSite.js';

describe('runCrawlSite', () => {
  it('creates siteCrawls row, uploads artifacts, marks status=ok', async () => {
    const inserts: any[] = [];
    const updates: any[] = [];
    const fakeDb = {
      insert: () => ({ values: (v: any) => { inserts.push(v); return Promise.resolve(); } }),
      update: () => ({ set: (v: any) => ({ where: () => { updates.push(v); return Promise.resolve(); } }) }),
      query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', domain: 'x.com' }) } },
    };
    const uploads: string[] = [];
    const fetchFn = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => url.endsWith('sitemap.xml')
        ? '<urlset><url><loc>https://x.com/</loc></url></urlset>'
        : '<html><body>Hi</body></html>',
      arrayBuffer: async () => new TextEncoder().encode(`page ${url}`),
      headers: new Headers([['content-type', 'text/html']]),
    }));
    const result = await runCrawlSite({
      merchantId: 'm1',
      db: fakeDb as never,
      uploadObject: async (key) => { uploads.push(key); },
      fetchFn: fetchFn as never,
      now: () => new Date('2026-05-24T00:00:00Z'),
    });
    expect(result.status).toBe('ok');
    expect(result.crawlId).toBeDefined();
    expect(uploads.length).toBeGreaterThan(0);
    expect(inserts.length).toBeGreaterThan(0);
    // Fetched, not yet read: the extract job marks it ok once the pages are learned.
    expect(updates.some((u) => u.status === 'extracting')).toBe(true);
  });

  it('skips owner-excluded folders, duplicate spellings and "page not found" shells', async () => {
    const inserts: any[] = [];
    const updates: any[] = [];
    const fakeDb = {
      insert: () => ({ values: (v: any) => { inserts.push(v); return Promise.resolve(); } }),
      update: () => ({ set: (v: any) => ({ where: () => { updates.push(v); return Promise.resolve(); } }) }),
      query: {
        merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'm1', domain: 'x.com', kbExcludedPaths: ['/blog/'] }) },
      },
    };
    const real = new Set(['https://x.com/', 'https://x.com/about', 'https://x.com/about/', 'https://x.com/blog/post', 'https://x.com/shop/gummy/']);
    const fetched: string[] = [];
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      fetched.push(url);
      const body = url.endsWith('/sitemap.xml')
        ? `<urlset>${[...real].map((u) => `<loc>${u}</loc>`).join('')}</urlset>`
        : real.has(url) ? `real ${url}` : 'NOT FOUND SHELL';
      return {
        ok: true,
        status: 200,
        text: async () => body,
        arrayBuffer: async () => new TextEncoder().encode(body),
        headers: new Headers([['content-type', 'text/html']]),
      };
    });
    await runCrawlSite({ merchantId: 'm1', db: fakeDb as never, uploadObject: vi.fn(), fetchFn: fetchFn as never });
    const artifactUrls = inserts.filter((v) => 'urlHash' in v).map((v) => v.url);
    expect(artifactUrls.sort()).toEqual(['https://x.com/', 'https://x.com/about', 'https://x.com/shop/gummy/']);
    expect(fetched).not.toContain('https://x.com/blog/post');
    const done = updates.find((u) => u.status === 'extracting');
    expect(done.stats.excluded).toEqual(['https://x.com/blog/post']);
    expect(done.stats.duplicates).toContain('https://x.com/about/');
    expect(done.stats.notFound).toContain('https://x.com/pages/faq');
    expect(done.pageCount).toBe(3);
  });

  it('returns failed when merchant missing', async () => {
    const fakeDb = {
      insert: () => ({ values: () => Promise.resolve() }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      query: { merchants: { findFirst: vi.fn().mockResolvedValue(undefined) } },
    };
    const result = await runCrawlSite({
      merchantId: 'missing',
      db: fakeDb as never,
      uploadObject: vi.fn(),
      fetchFn: vi.fn() as never,
    });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('merchant');
  });
});
