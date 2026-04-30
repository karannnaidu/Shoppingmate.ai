import type { FingerprintRule } from './index.js';

export const shopifyRule: FingerprintRule = {
  platform: 'shopify',
  matches: (html) => {
    if (/<meta\s+name=["']generator["']\s+content=["']Shopify/i.test(html)) return true;
    if (/cdn\.shopify\.com/i.test(html)) return true;
    if (/window\.Shopify\s*=/i.test(html)) return true;
    return false;
  },
};
