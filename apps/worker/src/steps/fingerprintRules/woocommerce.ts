import type { FingerprintRule } from './index.js';

export const woocommerceRule: FingerprintRule = {
  platform: 'woocommerce',
  matches: (html) => {
    if (/<meta\s+name=["']generator["']\s+content=["']WooCommerce/i.test(html)) return true;
    if (/wp-content\/plugins\/woocommerce/i.test(html)) return true;
    if (/<body[^>]*class=["'][^"']*\bwoocommerce\b[^"']*["']/i.test(html)) return true;
    return false;
  },
};
