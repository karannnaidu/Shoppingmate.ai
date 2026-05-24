import { describe, expect, it, vi } from 'vitest';
import { uploadObject, siteGraphKey } from './r2-upload.js';

describe('uploadObject', () => {
  it('sends PutObjectCommand with key + body + contentType', async () => {
    const send = vi.fn().mockResolvedValue({});
    const fakeClient = { send } as never;
    await uploadObject('site-graph/m1/c1/sitemap.xml', Buffer.from('<xml/>'), 'application/xml', fakeClient);
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.Bucket).toBeDefined();
    expect(cmd.input.Key).toBe('site-graph/m1/c1/sitemap.xml');
    expect(cmd.input.ContentType).toBe('application/xml');
  });
});

describe('siteGraphKey', () => {
  it('builds merchantId/crawlId/suffix path', () => {
    expect(siteGraphKey('m1', 'c1', 'pages/abc123.html')).toBe('m1/c1/pages/abc123.html');
  });
});
