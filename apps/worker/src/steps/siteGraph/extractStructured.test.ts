import { describe, expect, it, vi } from 'vitest';
import { extractStructured } from './extractStructured.js';

describe('extractStructured', () => {
  it('parses LLM JSON response into normalized rows', async () => {
    const fakeLlm = vi.fn().mockResolvedValue({
      pageType: 'pdp',
      title: 'Kibble X',
      h1: 'Kibble X — high-protein',
      intents: [{ intentKey: 'add to cart', selectorHint: 'button.atc' }],
      navLinks: [{ anchorText: 'Shop', href: '/shop', location: 'header' }],
      faq: [],
      policy: null,
      media: [{ mediaUrl: 'https://x.com/img.jpg', originalAlt: '', role: 'product' }],
    });
    const out = await extractStructured({
      html: '<html><body>Kibble X</body></html>',
      url: 'https://x.com/products/kibble-x',
      llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('pdp');
    expect(out.title).toBe('Kibble X');
    expect(out.intents[0].intentKey).toBe('add to cart');
    expect(out.media[0].mediaUrl).toBe('https://x.com/img.jpg');
  });

  it('returns safe defaults on LLM parse failure', async () => {
    const fakeLlm = vi.fn().mockRejectedValue(new Error('bad json'));
    const out = await extractStructured({
      html: '<html/>', url: 'https://x.com/', llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('other');
    expect(out.intents).toEqual([]);
  });
});
