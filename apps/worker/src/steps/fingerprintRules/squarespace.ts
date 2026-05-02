import type { FingerprintRule } from './index.js';

export const squarespaceRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'squarespace',
  matches: (html, headers) => {
    if (/squarespace/i.test(headers.server ?? '')) return true;
    if (/SQUARESPACE_CONTEXT|data-static-styles-namespace=["']squarespace/i.test(html)) return true;
    return false;
  },
};
