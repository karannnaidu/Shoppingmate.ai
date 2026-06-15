import { describe, expect, it } from 'vitest';
import { redactPii, segmentSay, stripPrices, stripToolSyntax } from './postprocess.js';

describe('stripPrices()', () => {
  it.each([
    ['₹1,499', 'the price on the card'],
    ['costs ₹1,499 only', 'costs the price on the card only'],
    ['$2,200.00', 'the price on the card'],
    ['Rs. 350', 'the price on the card'],
    ['Rs350', 'the price on the card'],
    ['saves you 1,499 rupees', 'saves you the price on the card'],
    ['that is 99 USD', 'that is the price on the card'],
    ['size 10', 'size 10'], // non-price untouched
    ['12 reviews', '12 reviews'],
    ['M, L, XL', 'M, L, XL'],
    ['I have 3 in cart', 'I have 3 in cart'],
  ])('strips %s', (input, expected) => {
    const { text, hits } = stripPrices(input);
    expect(text).toBe(expected);
    if (input !== expected) expect(hits.length).toBeGreaterThan(0);
  });

  it('reports the matched pattern in hits[]', () => {
    const r = stripPrices('₹1,499 and $20 too');
    expect(r.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: 'rupee' }),
        expect.objectContaining({ pattern: 'dollar' }),
      ]),
    );
  });
});

describe('redactPii()', () => {
  it.each([
    ['my email is jane@example.com', 'my email is [redacted]'],
    ['call me at +91 98765 43210', 'call me at [redacted]'],
    ['call me at 9876543210', 'call me at [redacted]'],
    ['card 4111 1111 1111 1111', 'card [redacted]'],
    ['card 4111111111111111', 'card [redacted]'],
    ['size 10 fits, 12 reviews', 'size 10 fits, 12 reviews'], // not PII
  ])('redacts %s', (input, expected) => {
    expect(redactPii(input)).toBe(expected);
  });
});

describe('stripToolSyntax', () => {
  it('removes a leaked dotted tool call with JSON args', () => {
    const out = stripToolSyntax(
      'I will take you there now. navigation.site.navigate({"url": "https://x.com/contact"})',
    );
    expect(out).toBe('I will take you there now.');
  });
  it('removes a bare tool call', () => {
    expect(stripToolSyntax('Sure. cart.add({"sku":"green-mantra"}) Done!')).toBe('Sure. Done!');
  });
  it('removes a python-kwarg style leak (the Gemini voice-caption form)', () => {
    // The exact shape seen leaking into Calmosis voice captions.
    expect(stripToolSyntax("Sure, adding Peace Mantra to your cart now. cart.add(sku='peace-mantra')")).toBe(
      'Sure, adding Peace Mantra to your cart now.',
    );
    expect(stripToolSyntax("Certainly. Sleep Mantra has been added. cart.add(sku='sleep-mantra')")).toBe(
      'Certainly. Sleep Mantra has been added.',
    );
  });
  it('leaves normal prose with parentheses untouched', () => {
    const s = 'Green Mantra (our calming blend) is a great pick.';
    expect(stripToolSyntax(s)).toBe(s);
  });
  it('leaves a sentence that ends in a period untouched', () => {
    const s = 'You can consult our practitioner.';
    expect(stripToolSyntax(s)).toBe(s);
  });
  it('strips a leaked snake_case tool token (robot_call:) glued to a word', () => {
    expect(stripToolSyntax('I have added Peace Mantra to your cart.robot_call: robot_call:')).toBe(
      'I have added Peace Mantra to your cart.',
    );
  });
  it('strips a repeated bare snake_case token', () => {
    expect(stripToolSyntax('Taking you to checkout now.robot_call: robot_call:')).toBe(
      'Taking you to checkout now.',
    );
  });
  it('leaves hyphenated product names untouched', () => {
    const s = 'The green-mantra blend is a calm, easy pick.';
    expect(stripToolSyntax(s)).toBe(s);
  });
  it('strips a no-paren site.navigate trailer (with a URL arg)', () => {
    expect(
      stripToolSyntax(
        "I'm taking you to our shop page now. You can see all of our products there. site.navigate https://calmosis.com/shop/",
      ),
    ).toBe("I'm taking you to our shop page now. You can see all of our products there.");
  });
  it('strips a glued products.search trailer', () => {
    expect(
      stripToolSyntax("I've pulled it up for you.products.search sleep-mantra"),
    ).toBe("I've pulled it up for you.");
    expect(stripToolSyntax('Certainly. Here is Peace Mantra.products.search peace-mantra')).toBe(
      'Certainly. Here is Peace Mantra.',
    );
  });
  it('strips a glued cart.add trailer but keeps the sentence', () => {
    expect(
      stripToolSyntax('Sure, I have added Green Mantra to your cart. Anything else?cart.add green-mantra'),
    ).toBe('Sure, I have added Green Mantra to your cart. Anything else?');
  });
  it('strips chained coupons.apply + checkout.url and keeps the word "checkout"', () => {
    expect(
      stripToolSyntax(
        "Certainly. I'm applying the CALM10 discount now and taking you to checkout.coupons.apply CALM10 checkout.url",
      ),
    ).toBe("Certainly. I'm applying the CALM10 discount now and taking you to checkout.");
  });
  it('leaves the bare word "checkout." in prose untouched', () => {
    const s = "Great — let's head to checkout.";
    expect(stripToolSyntax(s)).toBe(s);
  });
});

describe('segmentSay()', () => {
  it('returns the whole string when no segmentation is needed', () => {
    expect(segmentSay('Two great picks. See the cards.')).toEqual([
      'Two great picks. See the cards.',
    ]);
  });
  it('splits on double-newline boundaries', () => {
    expect(segmentSay('First chunk.\n\nSecond chunk.')).toEqual(['First chunk.', 'Second chunk.']);
  });
  it('drops empty segments', () => {
    expect(segmentSay('hello\n\n\n\nworld')).toEqual(['hello', 'world']);
  });
});

describe('stripPrices() with allowed speech tokens', () => {
  it('passes through an exact-substring match of an allowed token', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
    ]);
    const input =
      'Great question. Starter is thirty dollars per month for one hundred conversations. Want to sign up?';
    const { text, hits } = stripPrices(input, allowed);
    expect(text).toBe(input.replace(/\s{2,}/g, ' ').trim());
    expect(hits.length).toBe(0);
  });

  it('still strips a free-form LLM rephrase that does not match', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
    ]);
    const { text, hits } = stripPrices('Starter costs $30 a month.', allowed);
    expect(text).toBe('Starter costs the price on the card a month.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('treats undefined allowedSpeechTokens as the legacy behavior (no bypass)', () => {
    const { text } = stripPrices('It is $30.');
    expect(text).toBe('It is the price on the card.');
  });

  it('handles multiple allowed tokens in the same string', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
      'Growth is sixty dollars per month for five hundred conversations.',
    ]);
    const input =
      'Two options: Starter is thirty dollars per month for one hundred conversations. Or Growth is sixty dollars per month for five hundred conversations.';
    const { text, hits } = stripPrices(input, allowed);
    expect(text).toBe(input);
    expect(hits.length).toBe(0);
  });
});
