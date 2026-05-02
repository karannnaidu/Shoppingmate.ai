import type { FingerprintRule } from './index.js';

export const magentoRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'magento',
  matches: (html, headers) => {
    if (/magento/i.test(headers['x-powered-by'] ?? '')) return true;
    if (/<meta[^>]+name=["']generator["'][^>]+Magento/i.test(html)) return true;
    if (/Magento_Catalog|Magento_Theme/i.test(html)) return true;
    return false;
  },
};
