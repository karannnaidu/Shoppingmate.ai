import { describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  db: {},
  schema: { sitePages: {} },
}));

vi.mock('@shoppingmate/jobs', () => ({
  siteGraphCrawlQueue: { add: vi.fn() },
}));

import { runDriftDetect } from './driftDetect.js';

describe('runDriftDetect', () => {
  it('enqueues full re-crawl when >3 pages changed', async () => {
    const pages = Array.from({ length: 20 }, (_, i) => ({
      url: `https://x.com/p${i}`, etag: `etag-${i}`,
    }));
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      headers: new Map([['etag', url.includes('p1') || url.includes('p2') || url.includes('p3') || url.includes('p4') ? 'changed' : 'same']]),
    }));
    const fakeDb = {
      query: {
        sitePages: { findMany: vi.fn().mockResolvedValue(pages.map((p, i) => ({
          ...p, meta: { etag: `etag-${i}` },
        }))) },
      },
    };
    const out = await runDriftDetect({
      merchantId: 'm1', db: fakeDb as never, fetchFn: fetchFn as never, enqueueCrawl: enqueue,
    });
    expect(out.recrawled).toBe(true);
    expect(enqueue).toHaveBeenCalledWith({ merchantId: 'm1' });
  });
});
