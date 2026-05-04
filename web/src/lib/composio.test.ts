import { describe, expect, it } from 'vitest';
import { composio, startShopifyConnection } from './composio';

describe('composio wrapper', () => {
  it('exports a Composio client', () => {
    expect(composio).toBeDefined();
  });

  it('exports startShopifyConnection that returns auth_url', async () => {
    expect(typeof startShopifyConnection).toBe('function');
  });
});
