import type { Merchant, SelectorCacheRow, SelectorSource } from '@shoppingmate/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory selector_cache store + minimal getProduct/searchProducts stubs.
type Row = {
  merchantId: string;
  pageTemplateHash: string;
  selectorKey: string;
  resolvedSelector: string;
  source: SelectorSource;
  locked: boolean;
  lastTestedAt: Date | null;
  lastTestPassed: boolean | null;
  overrideLockedAt: Date | null;
  suggestedReplacement: string | null;
  alertSentAt: Date | null;
};

const store = new Map<string, Row>();
const k = (m: string, h: string, sk: string): string => `${m}|${h}|${sk}`;

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => []),
  getProduct: vi.fn(async () => null),
  selectorCacheRepo: {
    async get(m: string, h: string, sk: string): Promise<SelectorCacheRow | null> {
      return (store.get(k(m, h, sk)) as unknown as SelectorCacheRow) ?? null;
    },
    async put(
      m: string,
      h: string,
      sk: string,
      sel: string,
      source: SelectorSource,
    ): Promise<void> {
      const now = new Date();
      const existing = store.get(k(m, h, sk));
      store.set(k(m, h, sk), {
        merchantId: m,
        pageTemplateHash: h,
        selectorKey: sk,
        resolvedSelector: sel,
        source,
        locked: source === 'merchant_override',
        lastTestedAt: existing?.lastTestedAt ?? null,
        lastTestPassed: existing?.lastTestPassed ?? null,
        overrideLockedAt: source === 'merchant_override' ? now : null,
        suggestedReplacement: existing?.suggestedReplacement ?? null,
        alertSentAt: existing?.alertSentAt ?? null,
      });
    },
    async upsertHealed(m: string, h: string, sk: string, sel: string): Promise<void> {
      const existing = store.get(k(m, h, sk));
      if (existing?.source === 'merchant_override') return;
      const now = new Date();
      store.set(k(m, h, sk), {
        merchantId: m,
        pageTemplateHash: h,
        selectorKey: sk,
        resolvedSelector: sel,
        source: 'llm_resolved',
        locked: false,
        lastTestedAt: now,
        lastTestPassed: true,
        overrideLockedAt: null,
        suggestedReplacement: null,
        alertSentAt: null,
      });
    },
    async markOverrideFailing(
      m: string,
      h: string,
      sk: string,
      suggestion: string | null,
    ): Promise<void> {
      const existing = store.get(k(m, h, sk));
      if (!existing) return;
      existing.lastTestPassed = false;
      existing.lastTestedAt = new Date();
      existing.suggestedReplacement = suggestion;
    },
    async markPassed(m: string, h: string, sk: string): Promise<void> {
      const existing = store.get(k(m, h, sk));
      if (!existing) return;
      existing.lastTestPassed = true;
      existing.lastTestedAt = new Date();
    },
  },
}));

const merchant = {
  id: 'SM-T01',
  domain: 'custom.example.com',
  adapterType: 'dom',
  adapterConfig: {
    selectors: { add_to_cart_button: '.config-default' },
    page_templates: { product: 'h1' },
  },
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

beforeEach(() => {
  store.clear();
});

describe('resolveSelector', () => {
  it('returns adapter_config selector when no cache row', async () => {
    const { resolveSelector } = await import('../../src/dom/resolver.js');
    const r = await resolveSelector({
      merchant,
      sessionId: 's',
      pageTemplateHash: 'h1',
      selectorKey: 'add_to_cart_button',
    });
    expect(r).toEqual({ kind: 'use_selector', selector: '.config-default', source: 'auto' });
  });

  it('returns cached llm_resolved selector', async () => {
    const { selectorCacheRepo } = await import('@shoppingmate/db');
    await selectorCacheRepo.upsertHealed('SM-T01', 'h1', 'add_to_cart_button', '#cached');
    const { resolveSelector } = await import('../../src/dom/resolver.js');
    const r = await resolveSelector({
      merchant,
      sessionId: 's',
      pageTemplateHash: 'h1',
      selectorKey: 'add_to_cart_button',
    });
    expect(r).toEqual({
      kind: 'use_selector',
      selector: '#cached',
      source: 'llm_resolved',
    });
  });

  it('returns gave_up when no cache and no config selector', async () => {
    const m2 = {
      ...merchant,
      adapterConfig: { selectors: {}, page_templates: { product: 'h1' } },
    } as unknown as Merchant;
    const { resolveSelector } = await import('../../src/dom/resolver.js');
    const r = await resolveSelector({
      merchant: m2,
      sessionId: 's',
      pageTemplateHash: 'h1',
      selectorKey: 'add_to_cart_button',
    });
    expect(r.kind).toBe('gave_up');
  });

  it('respects merchant_override even when failing', async () => {
    const { selectorCacheRepo } = await import('@shoppingmate/db');
    await selectorCacheRepo.put(
      'SM-T01',
      'h1',
      'add_to_cart_button',
      '.override',
      'merchant_override',
    );
    await selectorCacheRepo.markOverrideFailing(
      'SM-T01',
      'h1',
      'add_to_cart_button',
      null,
    );
    const { resolveSelector } = await import('../../src/dom/resolver.js');
    const r = await resolveSelector({
      merchant,
      sessionId: 's',
      pageTemplateHash: 'h1',
      selectorKey: 'add_to_cart_button',
    });
    expect(r.kind).toBe('degrade_to_suggest');
  });
});

describe('markSelectorFailed (heal path)', () => {
  it('heals via LLM and caches result', async () => {
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const { markSelectorFailed } = await import('../../src/dom/resolver.js');
    const { selectorCacheRepo } = await import('@shoppingmate/db');
    const llmCall = vi.fn(async (_p: string) => '#headless-buy');
    const state = new InMemorySessionState();
    const r = await markSelectorFailed(
      {
        merchant,
        sessionId: 's',
        pageTemplateHash: 'h1',
        selectorKey: 'add_to_cart_button',
        html: '<html><button id="headless-buy">Buy</button></html>',
      },
      { llmCall, state, maxLlmPerSession: 5 },
    );
    expect(r).toEqual({
      kind: 'use_selector',
      selector: '#headless-buy',
      source: 'llm_resolved',
    });
    expect(llmCall).toHaveBeenCalledTimes(1);
    const cached = await selectorCacheRepo.get('SM-T01', 'h1', 'add_to_cart_button');
    expect(cached?.resolvedSelector).toBe('#headless-buy');
    expect(cached?.source).toBe('llm_resolved');
  });

  it('gives up after maxLlmPerSession', async () => {
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const { markSelectorFailed } = await import('../../src/dom/resolver.js');
    const llmCall = vi.fn(async () => '#x');
    const state = new InMemorySessionState();
    for (let i = 0; i < 5; i++) await state.incrResolver('s');
    const r = await markSelectorFailed(
      {
        merchant,
        sessionId: 's',
        pageTemplateHash: 'h1',
        selectorKey: 'add_to_cart_button',
        html: '<html/>',
      },
      { llmCall, state, maxLlmPerSession: 5 },
    );
    expect(r.kind).toBe('gave_up');
  });

  it('writes suggested_replacement (does NOT mutate selector) for failing override', async () => {
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const { markSelectorFailed } = await import('../../src/dom/resolver.js');
    const { selectorCacheRepo } = await import('@shoppingmate/db');
    await selectorCacheRepo.put(
      'SM-T01',
      'h1',
      'add_to_cart_button',
      '.override',
      'merchant_override',
    );
    const llmCall = vi.fn(async () => '#suggested');
    const r = await markSelectorFailed(
      {
        merchant,
        sessionId: 's',
        pageTemplateHash: 'h1',
        selectorKey: 'add_to_cart_button',
        html: '<html/>',
      },
      { llmCall, state: new InMemorySessionState(), maxLlmPerSession: 5 },
    );
    expect(r.kind).toBe('degrade_to_suggest');
    const row = await selectorCacheRepo.get('SM-T01', 'h1', 'add_to_cart_button');
    expect(row?.resolvedSelector).toBe('.override'); // unchanged
    expect(row?.suggestedReplacement).toBe('#suggested');
  });

  it('returns gave_up when no llmCall provided', async () => {
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const { markSelectorFailed } = await import('../../src/dom/resolver.js');
    const r = await markSelectorFailed(
      {
        merchant,
        sessionId: 's',
        pageTemplateHash: 'h1',
        selectorKey: 'add_to_cart_button',
        html: '<html/>',
      },
      { state: new InMemorySessionState() },
    );
    expect(r.kind).toBe('gave_up');
  });
});
