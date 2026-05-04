import { describe, expect, it } from 'vitest';
import { auth } from './auth';

describe('auth', () => {
  it('exports a Better-Auth instance', () => {
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe('function');
  });

  it('has email magic-link plugin enabled', () => {
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.signInMagicLink).toBe('function');
  });
});
