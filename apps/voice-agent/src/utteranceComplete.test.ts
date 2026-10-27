import { describe, expect, it } from 'vitest';
import { expectedSlot, utteranceHold } from './utteranceComplete.js';

// Lines from Karan's live call (2026-10-27 17:44 UTC) that were cut off.
describe('utteranceHold', () => {
  it('finished sentences are released at once', () => {
    for (const t of ['Hello.', 'Hello', 'Hi, can you hear me?', 'Can you book a consultant?', 'yes', 'okay', 'No thanks.'])
      expect(utteranceHold(t, null), t).toBe('none');
  });
  it('a sentence ending on a dangling word waits longer', () => {
    expect(utteranceHold('I wanted to look at', null)).toBe('long');
    expect(utteranceHold('I want the', null)).toBe('long');
    expect(utteranceHold('Can you tell me about the price and', null)).toBe('long');
    expect(utteranceHold('I wanted to look at.', null)).toBe('long');
    // …but these end real sentences.
    expect(utteranceHold('I wanted to look at. The Green Mantra please.', null)).toBe('none');
    expect(utteranceHold('Can I get two of this?', null)).toBe('none');
  });
  it('an unpunctuated multi-word fragment waits a little', () => {
    expect(utteranceHold('Why are you giving', null)).toBe('short');
    expect(utteranceHold('I wanted to look at green', null)).toBe('short');
  });
  it('a phone number still being dictated waits for all ten digits', () => {
    expect(utteranceHold('Yes, Sachin. 1 0', 'phone')).toBe('dictation');
    expect(utteranceHold('81079', 'phone')).toBe('dictation');
    expect(utteranceHold('my number is 98450', null)).toBe('dictation');
    expect(utteranceHold('98450 12345', 'phone')).toBe('none');
    expect(utteranceHold('+91 98450 12345.', 'phone')).toBe('none');
  });
  it('a pincode waits for six digits; an age does not wait', () => {
    expect(utteranceHold('5600', 'pincode')).toBe('dictation');
    expect(utteranceHold('560001', 'pincode')).toBe('none');
    expect(utteranceHold('42', 'age')).toBe('none');
  });
  it('slot patience only applies when the answer looks like that slot', () => {
    expect(utteranceHold("I'm looking for something to help me sleep better at night.", 'email')).toBe('none');
    expect(utteranceHold('karan at gmail dot', 'email')).toBe('dictation');
    expect(utteranceHold('karan at gmail dot com', 'email')).toBe('none');
    expect(utteranceHold('Actually, what about Sleep Mantra?', 'address')).toBe('none');
  });
  it('addresses get dictation patience unless they end in a pincode', () => {
    expect(utteranceHold('Flat 302, Green Park', 'address')).toBe('dictation');
    expect(utteranceHold('Flat 302, Green Park, Bangalore 560001', 'address')).toBe('none');
  });
});

describe('expectedSlot', () => {
  it('reads what Olivia just asked for', () => {
    expect(expectedSlot('And could you please provide your 10-digit phone number?')).toBe('phone');
    expect(expectedSlot("What's your pincode?")).toBe('pincode');
    expect(expectedSlot('Could you please tell me your age?')).toBe('age');
    expect(expectedSlot('What is your delivery address?')).toBe('address');
    expect(expectedSlot('Could you share your email address?')).toBe('email');
    expect(expectedSlot('Sleep Mantra is great for rest. Want me to add it?')).toBe(null);
  });
});
