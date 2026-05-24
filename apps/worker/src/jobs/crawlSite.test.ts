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
      arrayBuffer: async () => new TextEncoder().encode('hi'),
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
    expect(updates.some((u) => u.status === 'ok')).toBe(true);
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
