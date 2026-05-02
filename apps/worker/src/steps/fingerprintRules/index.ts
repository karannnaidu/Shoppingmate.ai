import type { PlatformValue } from '@shoppingmate/db/schema';
import { bigcommerceRule } from './bigcommerce.js';
import { magentoRule } from './magento.js';
import { shopifyRule } from './shopify.js';
import { squarespaceRule } from './squarespace.js';
import { wixRule } from './wix.js';
import { woocommerceRule } from './woocommerce.js';

export type DetectedPlatform = 'magento' | 'bigcommerce' | 'wix' | 'squarespace';

export type FingerprintRule = {
  platform: PlatformValue;
  detectedPlatform?: DetectedPlatform;
  matches: (html: string, headers: Record<string, string>) => boolean;
};

export type FingerprintResult = {
  platform: PlatformValue;
  detectedPlatform: DetectedPlatform | null;
};

// Order matters: Shopify and Woo are first-class (platform=shopify|woocommerce);
// the rest are detect-and-degrade rules (platform=custom + detectedPlatform set).
export const rules: FingerprintRule[] = [
  shopifyRule,
  woocommerceRule,
  magentoRule,
  bigcommerceRule,
  wixRule,
  squarespaceRule,
];

export function detectPlatform(html: string, headers: Record<string, string>): FingerprintResult {
  for (const rule of rules) {
    if (rule.matches(html, headers)) {
      return { platform: rule.platform, detectedPlatform: rule.detectedPlatform ?? null };
    }
  }
  return { platform: 'custom', detectedPlatform: null };
}
