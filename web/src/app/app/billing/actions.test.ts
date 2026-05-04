// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

const setMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(() => ({ set: setMock })) },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveAutoRecharge } from './actions';

describe('saveAutoRecharge', () => {
  it('persists enabled + threshold + pack_size', async () => {
    const fd = new FormData();
    fd.set('enabled', 'on');
    fd.set('threshold', '10');
    fd.set('pack_size', '200');
    await saveAutoRecharge(fd);
    expect(setMock).toHaveBeenCalledWith({
      autoRechargeEnabled: true,
      autoRechargeThreshold: 10,
      autoRechargePackSize: 200,
    });
  });
});
