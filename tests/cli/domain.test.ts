import { describe, expect, it } from 'vitest';
import { validateDomain } from '../../packages/cli/src/domain.js';

describe('validateDomain', () => {
  it('accepts a bare hostname', () => {
    expect(validateDomain('acmesoap.com')).toBe('acmesoap.com');
  });

  it('lowercases the hostname', () => {
    expect(validateDomain('AcmeSoap.COM')).toBe('acmesoap.com');
  });

  it('strips a leading https:// scheme', () => {
    expect(validateDomain('https://acmesoap.com')).toBe('acmesoap.com');
  });

  it('strips a trailing slash', () => {
    expect(validateDomain('acmesoap.com/')).toBe('acmesoap.com');
  });

  it('rejects a hostname with a path', () => {
    expect(() => validateDomain('acmesoap.com/products')).toThrow(/path/);
  });

  it('rejects an empty string', () => {
    expect(() => validateDomain('')).toThrow();
  });

  it('rejects whitespace-only input', () => {
    expect(() => validateDomain('   ')).toThrow();
  });

  it('rejects a value without a dot', () => {
    expect(() => validateDomain('acmesoap')).toThrow();
  });
});
