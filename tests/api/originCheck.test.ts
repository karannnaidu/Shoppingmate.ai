import { describe, expect, it } from 'vitest';
import { originMatches } from '../../apps/api/src/lib/originCheck.js';

describe('originMatches', () => {
  it('accepts when Origin host equals expected domain', () => {
    expect(originMatches('https://acmesoap.com', undefined, 'acmesoap.com')).toBe(true);
  });

  it('falls back to Referer when Origin is missing', () => {
    expect(originMatches(undefined, 'https://acmesoap.com/products/shampoo', 'acmesoap.com')).toBe(
      true,
    );
  });

  it('rejects when both headers are missing', () => {
    expect(originMatches(undefined, undefined, 'acmesoap.com')).toBe(false);
  });

  it('rejects when host does not match', () => {
    expect(originMatches('https://evil.com', undefined, 'acmesoap.com')).toBe(false);
  });

  it('does not auto-accept www variants', () => {
    expect(originMatches('https://www.acmesoap.com', undefined, 'acmesoap.com')).toBe(false);
  });

  it('rejects malformed Origin values', () => {
    expect(originMatches('not-a-url', undefined, 'acmesoap.com')).toBe(false);
  });

  it('handles non-default ports by ignoring them', () => {
    expect(originMatches('http://localhost:5173', undefined, 'localhost')).toBe(true);
  });
});
