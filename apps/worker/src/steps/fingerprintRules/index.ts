import type { PlatformValue } from '@shoppingmate/db/schema';
import { shopifyRule } from './shopify.js';
import { woocommerceRule } from './woocommerce.js';

export type FingerprintRule = {
  platform: Exclude<PlatformValue, 'custom'>;
  matches: (html: string, headers: Record<string, string>) => boolean;
};

export const rules: FingerprintRule[] = [shopifyRule, woocommerceRule];

export function detectPlatform(html: string, headers: Record<string, string>): PlatformValue {
  for (const rule of rules) {
    if (rule.matches(html, headers)) return rule.platform;
  }
  return 'custom';
}
