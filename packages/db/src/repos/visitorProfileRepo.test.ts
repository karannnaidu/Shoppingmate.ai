import { describe, expect, it } from 'vitest';
import { mergeProfile } from './visitorProfileRepo.js';
import type { IntentRecord } from '@shoppingmate/shared';

const rec = (over: Partial<IntentRecord>): IntentRecord => ({
  intent: 'ready_to_buy', intentConfidence: 0.8, needs: ['sleep'], objections: ['price'],
  preferences: { products: ['sleep-mantra'] }, affect: { sentiment: 'positive' },
  identity: { name: 'Karan' }, dropStage: 'address', ...over,
});

describe('mergeProfile', () => {
  it('starts a fresh profile from the first record', () => {
    const p = mergeProfile(null, rec({}), { outcome: 'abandoned', attributedCents: 0 });
    expect(p.sessionCount).toBe(1);
    expect(p.identity.name).toBe('Karan');
    expect(p.topIntents).toContain('ready_to_buy');
    expect(p.productsOfInterest).toContain('sleep-mantra');
  });
  it('latest-wins identity, accumulates intents/needs, sums LTV, bumps count', () => {
    const first = mergeProfile(null, rec({ identity: { name: 'K' } }), { outcome: 'abandoned', attributedCents: 0 });
    const second = mergeProfile(first as never, rec({ identity: { name: 'Karan', email: 'k@c.com' }, needs: ['stress'] }), { outcome: 'purchased', attributedCents: 450000 });
    expect(second.sessionCount).toBe(2);
    expect(second.identity.name).toBe('Karan');
    expect(second.identity.email).toBe('k@c.com');
    expect(second.needs).toEqual(expect.arrayContaining(['sleep', 'stress']));
    expect(second.lifetimeValueCents).toBe(450000);
    expect(second.lastOutcome).toBe('purchased');
  });
});
