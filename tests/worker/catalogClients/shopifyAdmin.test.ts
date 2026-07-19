import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchShopifyCatalogViaAdmin } from '../../../apps/worker/src/steps/catalogClients/shopifyAdmin.js';

const ENDPOINT = 'https://shop.test/admin/api/2026-07/graphql.json';

const PAGE = {
  data: {
    shop: { currencyCode: 'USD' },
    products: {
      edges: [
        {
          cursor: 'c1',
          node: {
            handle: 'tee',
            title: 'Tee',
            descriptionHtml: '<p>soft</p>',
            onlineStoreUrl: 'https://shop.test/products/tee',
            featuredImage: { url: 'https://cdn/tee.jpg' },
            variants: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/9001',
                    sku: 'TEE-S',
                    price: '20.00',
                    availableForSale: true,
                    selectedOptions: [{ name: 'Size', value: 'S' }],
                  },
                },
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/9002',
                    sku: 'TEE-L',
                    price: '22.00',
                    availableForSale: false,
                    selectedOptions: [{ name: 'Size', value: 'L' }],
                  },
                },
              ],
            },
          },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: 'c1' },
    },
  },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchShopifyCatalogViaAdmin', () => {
  it('pulls products via Admin GraphQL and normalizes numeric variant ids', async () => {
    let sawFilter: string | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as { variables?: { filter?: string } };
        sawFilter = body?.variables?.filter;
        return HttpResponse.json(PAGE);
      }),
    );

    const result = await fetchShopifyCatalogViaAdmin('shop.test', 'shpat_token', {
      cap: 5000,
      timeoutMs: 90_000,
    });

    // Only sellable products: excludes draft/archived (status) + hidden/unpublished.
    expect(sawFilter).toContain('status:active');
    expect(sawFilter).toContain('published_status:published');

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      sku: 'tee',
      title: 'Tee',
      description: 'soft',
      imageUrl: 'https://cdn/tee.jpg',
      productUrl: 'https://shop.test/products/tee',
      priceCents: 2000,
      currency: 'USD',
      inStock: true,
      source: 'shopify_storefront',
    });
    expect(result.products[0].variants).toEqual([
      { id: '9001', sku: 'TEE-S', priceCents: 2000, inStock: true, options: { option1: 'S' } },
      { id: '9002', sku: 'TEE-L', priceCents: 2200, inStock: false, options: { option1: 'L' } },
    ]);
  });

  it('sends the access token and returns failed on an auth error', async () => {
    let sawToken: string | null = null;
    server.use(
      http.post(ENDPOINT, ({ request }) => {
        sawToken = request.headers.get('x-shopify-access-token');
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const result = await fetchShopifyCatalogViaAdmin('shop.test', 'shpat_token', {
      cap: 5000,
      timeoutMs: 90_000,
    });
    expect(sawToken).toBe('shpat_token');
    expect(result.kind).toBe('failed');
  });
});
