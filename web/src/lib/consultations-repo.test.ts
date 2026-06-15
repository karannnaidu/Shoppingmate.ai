// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const rows = [
  {
    id: 1,
    name: 'Karan',
    age: 32,
    condition: null,
    phoneCountryCode: '+91',
    phone: '9876543210',
    status: 'new',
    sessionId: 's1',
    createdAt: new Date('2026-06-15T00:00:00Z'),
  },
];

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => Promise.resolve(rows) }),
        }),
      }),
    }),
  },
}));

import { listConsultations } from './consultations-repo';

describe('consultations-repo', () => {
  it('returns consultation rows for a merchant', async () => {
    const out = await listConsultations({ merchantId: 'SM-2SCCLZ', days: 30 });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Karan');
    expect(out[0].phoneCountryCode).toBe('+91');
    expect(out[0].sessionId).toBe('s1');
  });
});
