import type { FingerprintRule } from './index.js';

export const bigcommerceRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'bigcommerce',
  matches: (html, headers) => {
    if (/bigcommerce/i.test(headers['x-powered-by'] ?? '')) return true;
    if (/cdn11\.bigcommerce\.com|window\.BCData/i.test(html)) return true;
    return false;
  },
};
