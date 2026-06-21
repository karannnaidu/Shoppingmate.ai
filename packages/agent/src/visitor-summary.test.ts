import { describe, expect, it } from 'vitest';
import { buildVisitorSummary } from './visitor-summary.js';

const base = {
  id: 'm:v', merchantId: 'm', visitorId: 'v',
  identity: { name: 'Karan', city: 'Mumbai' },
  topIntents: ['price_sensitive', 'ready_to_buy'], needs: ['sleep', 'stress'],
  objections: ['price'], productsOfInterest: ['sleep-mantra'],
  lastOutcome: 'abandoned', lastDropStage: 'checkout', sessionCount: 2,
  lifetimeValueCents: 149900, lastSeen: new Date(0),
};

describe('buildVisitorSummary', () => {
  it('returns empty string for unknown / first-time visitor', () => {
    expect(buildVisitorSummary(null)).toBe('');
    expect(buildVisitorSummary({ ...base, sessionCount: 0 })).toBe('');
  });
  it('summarizes a returning visitor with name, intent, and last outcome', () => {
    const s = buildVisitorSummary(base);
    expect(s).toContain('Karan');
    expect(s).toContain('price_sensitive');
    expect(s).toContain('abandoned');
    expect(s.length).toBeLessThan(400);
  });
});
