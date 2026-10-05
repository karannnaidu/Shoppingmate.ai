import { describe, expect, it } from 'vitest';
import { COMBOS, evaluatePage } from './nightlyQa.js';

const template = {
  skeleton: ['button|add to cart', 'button|buy now', 'link|shop', 'link|home', 'link|blog'],
  recipes: [
    { action: 'add_to_cart', role: 'button', name: 'Add to cart' },
    { action: 'variant', role: 'radio', name: '50 ml' },
  ],
};

describe('nightly QA checks', () => {
  it('covers Chrome + Safari engines on desktop and mobile', () => {
    expect(COMBOS.map((c) => c.name)).toEqual([
      'chrome-desktop',
      'chrome-android',
      'safari-desktop',
      'safari-iphone',
    ]);
    expect(new Set(COMBOS.map((c) => c.engine))).toEqual(new Set(['chromium', 'webkit']));
  });

  it('passes a healthy page', () => {
    const checks = evaluatePage({
      widgetPresent: true,
      launcherVisible: true,
      keys: template.skeleton,
      snapshot: '[e4] button "Add to cart"',
      widgetErrors: [],
      template,
    });
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks.map((c) => c.check)).toContain('add to cart control usable');
  });

  it('catches a hidden launcher, a redesign, a disabled add-to-cart and widget errors', () => {
    const checks = evaluatePage({
      widgetPresent: true,
      launcherVisible: false,
      keys: ['link|home'],
      snapshot: '[e4] button "Add to cart" (disabled)',
      widgetErrors: ['[shoppingmate] bootstrap failed'],
      template,
    });
    const failed = checks.filter((c) => !c.pass).map((c) => c.check);
    expect(failed).toEqual(
      expect.arrayContaining([
        'launcher visible',
        'no widget errors',
        'matches learned layout',
        'add to cart control usable',
      ]),
    );
  });
});
