import { describe, expect, it } from 'vitest';
import { emptyGraph } from '../types.js';
import { countTokens } from '../budget.js';
import { projectSonnetAddendum } from './sonnetAddendum.js';

describe('projectSonnetAddendum', () => {
  it('returns empty-graph fallback when no pages exist', () => {
    const out = projectSonnetAddendum(emptyGraph('m1'));
    expect(out.text).toContain('Brand site is being indexed');
    expect(out.truncated).toBe(false);
  });

  it('renders site map, nav, intents, key facts, faq in priority order', () => {
    const g = emptyGraph('m1', 1);
    g.pages = [
      { id: 'p1', url: '/', pageType: 'home', title: 'Home', h1: 'Welcome', meta: {} },
      { id: 'p2', url: '/pricing', pageType: 'other', title: 'Pricing', h1: null, meta: {} },
    ];
    g.navEdges = [{ fromPageId: 'p1', toPageId: 'p2', anchorText: 'Pricing', linkLocation: 'header' }];
    g.intentsByPageId.set('p2', [
      { intentKey: 'starter plan card', selectorHint: '.starter', meta: {} },
      { intentKey: 'sign up button', selectorHint: '#signup', meta: {} },
    ]);
    g.policies = [{ policyType: 'returns', summary: '30-day returns, free shipping.', pageId: 'p1' }];
    g.faq = [{ question: 'Do you ship to UK?', answer: 'Yes.', pageId: null, sourceUrl: null }];
    const out = projectSonnetAddendum(g);
    expect(out.text).toContain('SITE MAP');
    expect(out.text).toContain('/pricing');
    expect(out.text).toContain('NAV (from header):');
    expect(out.text).toContain('Pricing');
    expect(out.text).toContain('"starter plan card"');
    expect(out.text).toContain('KEY FACTS');
    expect(out.text).toContain('Returns: 30-day returns');
    expect(out.text).toContain('FAQ');
    expect(out.text).toContain('Do you ship to UK?');
    expect(out.truncated).toBe(false);
  });

  it('truncates FAQ first, then intents, when over budget', () => {
    const g = emptyGraph('m1', 1);
    g.pages = Array.from({ length: 200 }, (_, i) => ({
      id: `p${i}`, url: `/p${i}`, pageType: 'other' as const, title: `Page ${i}`, h1: null, meta: {},
    }));
    g.faq = Array.from({ length: 50 }, (_, i) => ({
      question: `Question ${i} that is reasonably long to consume tokens`,
      answer: `Answer ${i} that is also reasonably long to consume tokens`,
      pageId: null, sourceUrl: null,
    }));
    const out = projectSonnetAddendum(g);
    expect(out.truncated).toBe(true);
    expect(countTokens(out.text)).toBeLessThanOrEqual(2000);
    expect(out.text).toContain('SITE MAP');
  });
});
