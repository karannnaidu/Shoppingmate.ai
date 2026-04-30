import { describe, expect, it } from 'vitest';
import { buildInstallSnippet } from '../../packages/cli/src/snippet.js';

describe('buildInstallSnippet', () => {
  it('emits a script tag with the merchantId in data-merchant', () => {
    const out = buildInstallSnippet('SM-A7K2X9');
    expect(out).toContain('data-merchant="SM-A7K2X9"');
    expect(out).toContain('<script');
    expect(out).toContain('async');
  });

  it('points at the production cdn host', () => {
    const out = buildInstallSnippet('SM-XXXXXX');
    expect(out).toMatch(/src="https:\/\/cdn\.shoppingmate\.ai\/gtag\.js"/);
  });

  it('throws on a malformed merchantId', () => {
    expect(() => buildInstallSnippet('not-a-merchant')).toThrow();
    expect(() => buildInstallSnippet('SM-')).toThrow();
    expect(() => buildInstallSnippet('SM-ABC')).toThrow();
  });
});
