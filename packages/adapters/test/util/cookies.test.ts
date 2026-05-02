import { describe, expect, it } from 'vitest';
import { formatCookieHeader, parseSetCookie } from '../../src/util/cookies.js';

describe('parseSetCookie', () => {
  it('parses single Set-Cookie', () => {
    const h = new Headers();
    h.set('set-cookie', 'cart=abc123; path=/; Max-Age=86400');
    expect(parseSetCookie(h)).toEqual({ cart: 'abc123' });
  });

  it('parses multiple Set-Cookie via getSetCookie if available', () => {
    const h = new Headers();
    h.append('set-cookie', 'a=1; path=/');
    h.append('set-cookie', 'b=2; path=/');
    const got = parseSetCookie(h);
    expect(got.a).toBe('1');
    expect(got.b).toBe('2');
  });
});

describe('formatCookieHeader', () => {
  it('serializes a jar', () => {
    expect(formatCookieHeader({ a: '1', b: '2' })).toBe('a=1; b=2');
  });
});
