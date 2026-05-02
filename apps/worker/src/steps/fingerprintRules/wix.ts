import type { FingerprintRule } from './index.js';

export const wixRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'wix',
  matches: (html) => {
    if (/<meta[^>]+name=["']generator["'][^>]+Wix/i.test(html)) return true;
    if (/static\.parastorage\.com|wix-thunderbolt|_wixCIDX/i.test(html)) return true;
    return false;
  },
};
