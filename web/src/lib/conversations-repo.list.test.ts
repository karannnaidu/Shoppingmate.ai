import { describe, expect, it, vi } from 'vitest';
import { listConversations } from './conversations-repo';

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { id: 'c1', startedAt: new Date(), durationSec: 60, turns: 4, mode: 'voice', outcome: 'purchased', attributedCents: 5000 },
            ]),
          })),
        })),
      })),
    })),
  },
}));

describe('listConversations', () => {
  it('returns rows with default pagination', async () => {
    const rows = await listConversations({ merchantId: 'SM-X', limit: 50 });
    expect(rows.length).toBe(1);
  });
});
