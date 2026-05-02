import { describe, expect, it } from 'vitest';
import { selectorExtract } from '../../apps/worker/src/steps/selectorExtract.js';

describe('selectorExtract', () => {
  it('renders pages, hashes templates, calls Sonnet, returns selectors', async () => {
    const renderedUrls: string[] = [];
    const llmCalled: { messageCount: number } = { messageCount: 0 };

    const result = await selectorExtract({
      merchantId: 'SM-TEST',
      domain: 'custom.test',
      sampleProductUrl: 'https://custom.test/products/widget-a',
      cartUrl: 'https://custom.test/cart',
      checkoutUrl: 'https://custom.test/checkout',
      renderHtml: async (url) => {
        renderedUrls.push(url);
        return `<html><body><div id="${url.split('/').pop()}">test</div></body></html>`;
      },
      callLlm: async ({ messages }) => {
        llmCalled.messageCount = messages.length;
        return JSON.stringify({
          add_to_cart_button: '#add-to-cart',
          qty_input: 'input[name=quantity]',
          variant_selector_template: '.variant[data-value="{value}"]',
          cart_url: '/cart',
          cart_page_total: '.cart-total',
          checkout_button: '#checkout',
          coupon_field: '#coupon',
          coupon_apply_button: '#apply-coupon',
          line_item_remove_button: '.remove-item',
          thank_you_order_id: '.order-id',
          thank_you_total: '.order-total',
        });
      },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(renderedUrls).toEqual([
      'https://custom.test/products/widget-a',
      'https://custom.test/cart',
      'https://custom.test/checkout',
    ]);
    expect(llmCalled.messageCount).toBeGreaterThanOrEqual(2);
    expect(result.selectors.add_to_cart_button).toBe('#add-to-cart');
    expect(result.pageTemplates.product).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.pageTemplates.cart).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('returns failed on llm parse failure', async () => {
    const result = await selectorExtract({
      merchantId: 'SM-TEST',
      domain: 'custom.test',
      sampleProductUrl: 'https://custom.test/products/widget-a',
      cartUrl: 'https://custom.test/cart',
      checkoutUrl: 'https://custom.test/checkout',
      renderHtml: async () => '<html><body>x</body></html>',
      callLlm: async () => 'not json',
    });
    expect(result.kind).toBe('failed');
  });
});
