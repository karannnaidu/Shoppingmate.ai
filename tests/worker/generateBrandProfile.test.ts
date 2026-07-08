import { describe, expect, it, vi } from 'vitest';
import {
  generateBrandProfile,
  parseBrandProfile,
} from '../../apps/worker/src/steps/generateBrandProfile.js';

describe('parseBrandProfile', () => {
  it('parses a clean JSON object', () => {
    const raw = '{"brand_summary":"We sell tea.","brand_categories":["Tea","Accessories"]}';
    expect(parseBrandProfile(raw, [])).toEqual({
      brandSummary: 'We sell tea.',
      brandCategories: ['Tea', 'Accessories'],
    });
  });
  it('tolerates code fences and surrounding prose', () => {
    const raw =
      'Sure:\n```json\n{"brand_summary":"Coffee roaster.","brand_categories":["Coffee"]}\n```';
    expect(parseBrandProfile(raw, [])?.brandSummary).toBe('Coffee roaster.');
  });
  it('falls back to provided categories when the model omits them', () => {
    const raw = '{"brand_summary":"A shop."}';
    expect(parseBrandProfile(raw, ['Supplements'])).toEqual({
      brandSummary: 'A shop.',
      brandCategories: ['Supplements'],
    });
  });
  it('returns null without a usable summary', () => {
    expect(parseBrandProfile('{"brand_categories":["x"]}', [])).toBeNull();
    expect(parseBrandProfile('not json at all', [])).toBeNull();
    expect(parseBrandProfile('{bad json', [])).toBeNull();
  });
});

describe('generateBrandProfile', () => {
  const input = {
    brandName: 'Acme',
    domain: 'acme.test',
    crawledText: 'Acme makes durable outdoor gear for hikers. Free returns within 30 days.',
    productCategories: ['Backpacks', 'Tents'],
  };

  it('uses the LLM reply when it is well-formed', async () => {
    const chatFn = vi.fn(
      async () =>
        '{"brand_summary":"Acme makes outdoor gear for hikers.","brand_categories":["Backpacks","Tents"]}',
    );
    const profile = await generateBrandProfile(input, chatFn);
    expect(profile.brandSummary).toBe('Acme makes outdoor gear for hikers.');
    expect(profile.brandCategories).toEqual(['Backpacks', 'Tents']);
    expect(chatFn).toHaveBeenCalledOnce();
  });

  it('falls back deterministically (never empty) when the LLM returns garbage', async () => {
    const profile = await generateBrandProfile(input, async () => 'sorry, I cannot help');
    expect(profile.brandSummary).toContain('Acme makes durable outdoor gear');
    expect(profile.brandCategories).toEqual(['Backpacks', 'Tents']);
  });

  it('never throws when the LLM call itself fails', async () => {
    const profile = await generateBrandProfile(input, async () => {
      throw new Error('LLM 500');
    });
    expect(profile.brandSummary.length).toBeGreaterThan(0);
    expect(profile.brandCategories).toEqual(['Backpacks', 'Tents']);
  });

  it('uses a generic summary when there is no usable crawled text', async () => {
    const profile = await generateBrandProfile(
      { brandName: 'Acme', domain: 'acme.test', crawledText: '   ', productCategories: [] },
      async () => 'garbage',
    );
    expect(profile.brandSummary).toContain('Acme is an online store');
  });
});
