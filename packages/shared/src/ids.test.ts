import { describe, expect, it } from 'vitest';
import { generateMerchantId } from './ids.js';

describe('generateMerchantId', () => {
  it('returns a string starting with SM-', () => {
    const id = generateMerchantId();
    expect(id.startsWith('SM-')).toBe(true);
  });

  it('has 6 alphanumeric characters after the prefix', () => {
    const id = generateMerchantId();
    const suffix = id.slice(3);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('produces different ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateMerchantId()));
    expect(ids.size).toBe(100);
  });
});
