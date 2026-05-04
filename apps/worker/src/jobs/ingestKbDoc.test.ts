import { describe, expect, it, vi } from 'vitest';

const updateDoc = vi.fn().mockResolvedValue(undefined);
const insertChunks = vi.fn().mockResolvedValue(undefined);

vi.mock('@shoppingmate/db', () => ({
  db: {
    query: { brandKbDocuments: { findFirst: vi.fn().mockResolvedValue({ id: 'doc1', merchantId: 'SM-X', filename: 'a.txt', mimeType: 'text/plain', storageUrl: 'm/SM-X/a.txt' }) } },
    insert: vi.fn(() => ({ values: insertChunks })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateDoc })) })),
  },
  schema: { brandKbDocuments: {}, brandKbChunks: {}, merchants: {} },
}));

vi.mock('../r2-download', () => ({
  downloadKbObject: vi.fn().mockResolvedValue(Buffer.from('Hello world. This is a returns policy. We accept returns within 30 days.')),
}));

import { ingestKbDoc } from './ingestKbDoc';

describe('ingestKbDoc', () => {
  it('downloads, chunks, inserts, marks ready', async () => {
    const result = await ingestKbDoc({ documentId: 'doc1' });
    expect(result.status).toBe('ready');
    expect(insertChunks).toHaveBeenCalled();
  });
});
