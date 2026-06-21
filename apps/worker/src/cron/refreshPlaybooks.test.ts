import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state: { rows: Array<{ tags: unknown }> } = { rows: [] };
  return {
    state,
    upsertBrandPlaybook: vi.fn(),
    loadBrandPlaybook: vi.fn(),
    // Chainable query builder that resolves to canned rows.
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(state.rows)),
      })),
    })),
  };
});

const { upsertBrandPlaybook } = h;

vi.mock('@shoppingmate/db', () => ({
  db: { select: h.select },
  schema: {
    metricEvents: {
      tags: 'tags',
      merchantId: 'merchantId',
      metricName: 'metricName',
      ts: 'ts',
    },
  },
  upsertBrandPlaybook: h.upsertBrandPlaybook,
  loadBrandPlaybook: h.loadBrandPlaybook,
}));

import { runPlaybookRefresh } from './refreshPlaybooks.js';

function makeRow(outcome: string) {
  return {
    tags: {
      outcome,
      attributed_cents: outcome === 'purchased' ? 4999 : 0,
      intent: {
        intent: 'buy',
        needs: ['gentle'],
        objections: ['price'],
        preferences: { coupon: outcome === 'purchased' },
        dropStage: outcome === 'abandoned' ? 'checkout' : undefined,
      },
    },
  };
}

describe('runPlaybookRefresh', () => {
  const chat = vi.fn();

  beforeEach(() => {
    upsertBrandPlaybook.mockClear();
    chat.mockReset();
  });

  it('returns below_threshold and does not upsert when fewer than minConversations rows', async () => {
    h.state.rows = Array.from({ length: 5 }, () => makeRow('purchased'));
    const out = await runPlaybookRefresh({ merchantId: 'm1', chat, minConversations: 20 });
    expect(out).toEqual({ ok: false, reason: 'below_threshold', count: 5 });
    expect(upsertBrandPlaybook).not.toHaveBeenCalled();
  });

  it('distils and upserts on happy path (>= threshold)', async () => {
    h.state.rows = Array.from({ length: 25 }, (_, i) => makeRow(i % 2 === 0 ? 'purchased' : 'abandoned'));
    chat.mockResolvedValue({ text: 'SELLING PLAYBOOK: lead with gentleness, counter price objections.' });
    const out = await runPlaybookRefresh({ merchantId: 'm1', chat, minConversations: 20 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.count).toBe(25);
      expect(out.playbook).toContain('SELLING PLAYBOOK');
    }
    expect(upsertBrandPlaybook).toHaveBeenCalledWith(
      'm1',
      expect.stringContaining('SELLING PLAYBOOK'),
      25,
    );
  });

  it('returns distil_empty and does not upsert when chat yields empty text', async () => {
    h.state.rows = Array.from({ length: 25 }, () => makeRow('purchased'));
    chat.mockResolvedValue({ text: '' });
    const out = await runPlaybookRefresh({ merchantId: 'm1', chat, minConversations: 20 });
    expect(out).toEqual({ ok: false, reason: 'distil_empty', count: 25 });
    expect(upsertBrandPlaybook).not.toHaveBeenCalled();
  });
});
