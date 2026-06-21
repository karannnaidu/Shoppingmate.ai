import { describe, expect, it, vi } from 'vitest';

const MOCK_ROW = {
  visitorId: 'v1',
  identity: { name: 'Karan', city: 'Mumbai' },
  topIntents: ['ready_to_buy'],
  needs: ['sleep'],
  sessionCount: 2,
  lifetimeValueCents: 149900,
  lastOutcome: 'purchased',
  lastSeen: new Date(0),
};

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([MOCK_ROW])),
          })),
        })),
      })),
    })),
  },
}));

import { listAudience } from './audience-repo';

describe('listAudience', () => {
  it('maps a visitor_profiles row into an AudienceRow', async () => {
    const rows = await listAudience({ merchantId: 'SM-TEST01' });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.visitorId).toBe('v1');
    expect(r.name).toBe('Karan');
    expect(r.city).toBe('Mumbai');
    expect(r.topIntents).toContain('ready_to_buy');
    expect(r.needs).toContain('sleep');
    expect(r.sessionCount).toBe(2);
    expect(r.lifetimeValueCents).toBe(149900);
    expect(r.lastOutcome).toBe('purchased');
    expect(r.lastSeen).toEqual(new Date(0));
  });
});
