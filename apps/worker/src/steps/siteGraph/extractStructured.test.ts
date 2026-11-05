import { describe, expect, it, vi } from 'vitest';
import { extractStructured, classifyByUrl, policyFromHtml } from './extractStructured.js';

// Segment audit 2026-10-07: during the LLM outage every store ended up with
// zero policies even though /policies/* pages were crawled.
describe('policy fallback without the LLM', () => {
  const html = `<html><head><script>var x=1</script></head><body><header>Menu</header>
    <div class="shopify-policy__container"><div class="shopify-policy__body"><div class="rte">
    <p>We accept returns of unworn shoes within 30 days of delivery.</p><p>Refunds go back to the original payment method within 5&ndash;7 business days. Final-sale items can't be returned.</p>
    </div></div></div><footer>© store</footer></body></html>`;

  it('builds a returns policy from the page text', () => {
    const p = policyFromHtml('https://allbirds.com/policies/refund-policy', html);
    expect(p?.policyType).toBe('returns');
    expect(p?.summary).toMatch(/within 30 days/);
    expect(p?.summary).not.toMatch(/var x|Menu|© store/);
  });

  it('is used when the LLM call fails', async () => {
    const r = await extractStructured({
      url: 'https://allbirds.com/policies/refund-policy',
      html,
      llmCall: async () => {
        throw new Error('openrouter http 402');
      },
    } as Parameters<typeof extractStructured>[0]);
    expect(r.pageType).toBe('policy');
    expect(r.policy?.policyType).toBe('returns');
  });
});

describe('classifyByUrl', () => {
  it('types the root as home', () => {
    expect(classifyByUrl('https://calmosis.com/')).toBe('home');
    expect(classifyByUrl('https://calmosis.com')).toBe('home');
  });
  it('types legal/policy paths as policy', () => {
    for (const u of [
      'https://calmosis.com/legal/terms/',
      'https://calmosis.com/legal/privacy',
      'https://calmosis.com/legal/shipping/',
      'https://calmosis.com/legal/refund/',
      'https://calmosis.com/returns',
    ]) {
      expect(classifyByUrl(u)).toBe('policy');
    }
  });
  it('types faq as faq', () => {
    expect(classifyByUrl('https://calmosis.com/faq/')).toBe('faq');
    expect(classifyByUrl('https://calmosis.com/faqs')).toBe('faq');
  });
  it('types the shop listing as plp (but not a product under it)', () => {
    expect(classifyByUrl('https://calmosis.com/shop/')).toBe('plp');
    expect(classifyByUrl('https://calmosis.com/collections')).toBe('plp');
    // a specific product under /shop is NOT plp (handled as pdp upstream)
    expect(classifyByUrl('https://calmosis.com/shop/peace-mantra')).toBeNull();
  });
  it('returns null for unknown paths (LLM/other decides)', () => {
    expect(classifyByUrl('https://calmosis.com/blog/some-post')).toBeNull();
    expect(classifyByUrl('not a url')).toBeNull();
  });
});

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
      html: '<html><body>Kibble X<button>Add to cart</button></body></html>',
      url: 'https://x.com/products/kibble-x',
      llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('pdp');
    expect(out.title).toBe('Kibble X');
    expect(out.intents[0].intentKey).toBe('add to cart');
    expect(out.media[0].mediaUrl).toBe('https://x.com/img.jpg');
    // No Product JSON-LD, but a product URL: the page itself becomes the product.
    expect(out.product?.sku).toBe('kibble-x');
    expect(out.product?.title).toBe('Kibble X — high-protein');
  });

  // 2026-11-06: Calmosis launched Holistic Gummy with NO Product JSON-LD (only
  // Organization/WebSite), so a re-scan never added it to the catalog.
  it('builds a product from a product page that has no Product JSON-LD', async () => {
    const html = `<html><head><title>Holistic Gummy — Ayurvedic Vijaya Wellness Gummy | Calmosis</title>
      <meta name="description" content="India&#39;s premium Ayurvedic wellness gummy for calm &amp; sleep.">
      <meta property="og:site_name" content="Calmosis">
      <script type="application/ld+json">{"@type":"Organization","name":"Calmosis"}</script></head>
      <body><h1>Holistic Gummy</h1><img src="/holistic-gummy/md/pack.webp" alt="Holistic Gummy — 10-Day Ritual">
      <button type="button"><span>Add to Cart</span></button>
      <div>10-Day Ritual 10 gummies ₹500 ₹450 / gummy</div><div>₹4,500</div></body></html>`;
    const withLlm = await extractStructured({
      html,
      url: 'https://calmosis.com/shop/holistic-gummy/',
      llmCall: vi.fn().mockResolvedValue({
        product: {
          name: 'Holistic Gummy',
          description: 'An Ayurvedic Vijaya gummy for calm and sleep.',
          currency: 'INR',
          options: [
            { label: '10-Day Ritual (10 gummies)', price: 4500 },
            { label: 'Monthly Ritual (30 gummies)', price: 12000 },
          ],
        },
      }),
    });
    expect(withLlm.pageType).toBe('pdp');
    expect(withLlm.product).toMatchObject({
      sku: 'holistic-gummy',
      title: 'Holistic Gummy',
      priceCents: 450000,
      currency: 'INR',
      imageUrl: 'https://calmosis.com/holistic-gummy/md/pack.webp',
      brand: 'Calmosis',
    });
    expect(withLlm.product?.description).toContain('Monthly Ritual (30 gummies) — ₹12,000');

    // LLM down: still a product, from the heading + meta + first price shown.
    const noLlm = await extractStructured({
      html,
      url: 'https://calmosis.com/shop/holistic-gummy/',
      llmCall: vi.fn().mockRejectedValue(new Error('quota')),
    });
    // ₹500 / ₹450 are per-gummy prices; the only pack price shown is ₹4,500.
    expect(noLlm.product).toMatchObject({ sku: 'holistic-gummy', title: 'Holistic Gummy', currency: 'INR', priceCents: 450000 });
    expect(noLlm.product?.description).toContain("India's premium Ayurvedic wellness gummy");

    // Several pack prices and no LLM: never guess one — list them instead.
    const multi = await extractStructured({
      html: html.replace('<div>₹4,500</div>', '<div>₹4,500</div><div>₹12,000</div>'),
      url: 'https://calmosis.com/shop/holistic-gummy/',
      llmCall: vi.fn().mockRejectedValue(new Error('quota')),
    });
    expect(multi.product?.priceCents).toBeNull();
    expect(multi.product?.description).toContain('₹4,500, ₹12,000');
  });

  it('a category landing page under /shop/ (no buy button) is not a product', async () => {
    const out = await extractStructured({
      html: '<html><body><h1>Vijaya Oil — AYUSH-Licensed Oils</h1><a href="/shop/green-mantra/">Green Mantra</a></body></html>',
      url: 'https://calmosis.com/shop/vijaya-oil/',
      llmCall: vi.fn().mockResolvedValue({ product: { name: 'Vijaya Oil', options: [] } }),
    });
    expect(out.product).toBeNull();
  });

  it('drops an LLM policy with an empty body instead of failing the read', async () => {
    const out = await extractStructured({
      html: '<html><body><p>short</p></body></html>',
      url: 'https://x.com/our-promise',
      llmCall: vi.fn().mockResolvedValue({ policy: { policyType: 'returns', summary: null, fullText: null } }),
    });
    expect(out.policy).toBeNull();
  });

  it('returns safe defaults on LLM parse failure (no deterministic URL signal)', async () => {
    const fakeLlm = vi.fn().mockRejectedValue(new Error('bad json'));
    // Use a path classifyByUrl can't type, so this exercises the LLM-failure
    // fallback to 'other' (a root/legal/faq/listing URL would type deterministically).
    const out = await extractStructured({
      html: '<html/>', url: 'https://x.com/our-story', llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('other');
    expect(out.intents).toEqual([]);
    expect(out.product).toBeNull();
  });

  it('harvests JSON-LD product even when LLM fails', async () => {
    const fakeLlm = vi.fn().mockRejectedValue(new Error('llm down'));
    const html = `
      <html><head>
        <script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Dog Mantra',
          description: 'THC-free CBD oil for pet anxiety',
          image: 'https://calmosis.com/img/dog-mantra.jpg',
          sku: 'dog-mantra',
          brand: { '@type': 'Brand', name: 'Calmosis' },
          offers: {
            '@type': 'Offer',
            price: '1499',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
          },
        })}</script>
      </head><body/></html>`;
    const out = await extractStructured({
      html, url: 'https://calmosis.com/shop/dog-mantra/', llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('pdp');
    expect(out.product?.title).toBe('Dog Mantra');
    expect(out.product?.sku).toBe('dog-mantra');
    expect(out.product?.priceCents).toBe(149900);
    expect(out.product?.currency).toBe('INR');
    expect(out.product?.inStock).toBe(true);
    expect(out.product?.brand).toBe('Calmosis');
    expect(out.title).toBe('Dog Mantra');
  });

  it('merges JSON-LD FAQs with LLM FAQs and dedupes', async () => {
    const fakeLlm = vi.fn().mockResolvedValue({
      pageType: 'pdp', title: 'X', h1: null, intents: [], navLinks: [],
      faq: [{ question: 'Is it safe?', answer: 'Yes, vet approved.' }],
      policy: null, media: [],
    });
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Is it safe?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } },
        { '@type': 'Question', name: 'When to give?', acceptedAnswer: { '@type': 'Answer', text: 'Daily.' } },
      ],
    })}</script>`;
    const out = await extractStructured({
      html, url: 'https://x.com/shop/y/', llmCall: fakeLlm,
    });
    expect(out.faq).toHaveLength(2);
    expect(out.faq.map((f) => f.question.toLowerCase())).toEqual(['is it safe?', 'when to give?']);
  });

  it('forces pageType=pdp when URL matches PDP pattern even without JSON-LD', async () => {
    const fakeLlm = vi.fn().mockResolvedValue({
      pageType: 'other', title: null, h1: null, intents: [], navLinks: [], faq: [], policy: null, media: [],
    });
    const out = await extractStructured({
      html: '<html/>', url: 'https://calmosis.com/shop/sleep-mantra/', llmCall: fakeLlm,
    });
    expect(out.pageType).toBe('pdp');
  });
});
