import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const insertReturning = vi.fn().mockResolvedValue([{ id: 'doc1' }]);
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: insertReturning })) })),
  },
}));

vi.mock('@/lib/r2', () => ({
  presignKbUpload: vi.fn().mockResolvedValue('https://r2.example/upload?sig=x'),
}));

vi.mock('@/lib/queue', () => ({
  enqueueKbIngest: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';

describe('POST /api/kb/upload', () => {
  it('returns presigned URL + document id', async () => {
    const req = new Request('http://localhost/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'returns.pdf', mimeType: 'application/pdf', sizeBytes: 12345 }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.upload_url).toContain('r2.example');
    expect(json.document_id).toBe('doc1');
  });

  it('rejects oversized files (> 10 MB)', async () => {
    const req = new Request('http://localhost/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: 20 * 1024 * 1024 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
