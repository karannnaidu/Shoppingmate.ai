import { describe, expect, it, vi } from 'vitest';

vi.mock('../client.js', () => ({ db: {} }));

import { buildOrTsQuery } from './catalogRepo.js';

// Segment audit 2026-10-07: natural shopper phrasing found nothing because
// search required every word and didn't stem.
describe('buildOrTsQuery', () => {
  it('keeps the meaningful words as OR-ed prefixes', () => {
    expect(buildOrTsQuery('sofa for small apartment')).toBe('sofa:* | small:* | apartment:*');
  });
  it('reduces plurals so "sofas" finds "sofa" and "boxes" finds "box"', () => {
    expect(buildOrTsQuery('sofas')).toBe('sofa:*');
    expect(buildOrTsQuery('gift boxes')).toBe('gift:* | box:*');
    expect(buildOrTsQuery('glass')).toBe('glass:*');
  });
  it('strips punctuation and returns null when nothing meaningful is left', () => {
    expect(buildOrTsQuery("I'm looking for the best")).toBeNull();
    expect(buildOrTsQuery('a to of')).toBeNull();
    expect(buildOrTsQuery("harness (dog's) 55lb")).toBe('harness:* | dog:* | 55lb:*');
  });
});
