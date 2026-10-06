import { describe, expect, it } from 'vitest';
import {
  claimsSavedDetails,
  geminiSignalsPlacement,
  stripSystemEcho,
  wantsDetailsFilled,
} from './agentWorker.js';
import { describeAction } from './bridge.js';

// Regression for the live 2026-10-06 voice checkout: the bot invented "saved
// details from your previous visit", said it filled them, nothing was filled,
// and cart.add was re-run on every turn.

describe('voice checkout honesty', () => {
  it('spots invented saved details in Gemini speech', () => {
    expect(
      claimsSavedDetails('shall I use the saved number and address from your previous visit?'),
    ).toBe(true);
    expect(claimsSavedDetails('I have your details on file from your last order')).toBe(true);
    expect(claimsSavedDetails('what is your phone number?')).toBe(false);
    expect(claimsSavedDetails('your address will be saved for next time')).toBe(false);
  });

  it('treats "help fill up my details" as a request to really fill', () => {
    expect(wantsDetailsFilled('Yeah help fill up my details you know.')).toBe(true);
    expect(wantsDetailsFilled('can you fill it in for me')).toBe(true);
    expect(wantsDetailsFilled('add sleep mantra')).toBe(false);
  });

  it('catches past-tense "filled" claims so the real fill runs (or corrects them)', () => {
    expect(
      geminiSignalsPlacement(
        'There we go. You should now see your details filled on the checkout page.',
      ),
    ).toBe(true);
    expect(
      geminiSignalsPlacement(
        "Ah, it seems there was a slight delay. I'm re-submitting your saved details now.",
      ),
    ).toBe(true);
    expect(
      geminiSignalsPlacement('Perfect. Filling in your saved details for you now, one moment.'),
    ).toBe(true);
  });

  it('drops a voiced "system" label from captions', () => {
    expect(stripSystemEcho("system Great. I'm applying the Bliss Club benefits.")).toBe(
      "Great. I'm applying the Bliss Club benefits.",
    );
    expect(stripSystemEcho('One moment. system There we go.')).toBe('One moment. There we go.');
    expect(stripSystemEcho('Our nervous system loves this.')).toBe('Our nervous system loves this.');
  });

  it('records what the executor already did so it is not repeated', () => {
    expect(describeAction({ type: 'cart_add', sku: 'sleep-mantra', qty: 1 }, { ok: true })).toBe(
      'added 1 × sleep-mantra to cart: done',
    );
    expect(describeAction({ type: 'checkout_state' }, { ok: false, reason: 'not_found' })).toMatch(
      /NO saved details/,
    );
    expect(describeAction({ type: 'navigate', path: '/checkout' }, { ok: true })).toBe(
      'opened /checkout: done',
    );
    expect(describeAction({ type: 'page_snapshot' }, { ok: true })).toBeNull();
  });
});
