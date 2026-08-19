import { describe, expect, it } from 'vitest';
import { hostOverlayOpen } from '../src/widget.js';

describe('hostOverlayOpen', () => {
  it('detects an open menu / nav drawer across common theme markers', () => {
    for (const cls of [
      'menu-open',
      'mobile-menu-open',
      'nav-open',
      'is-menu-open',
      'header-menu-open',
      'js-nav-open',
      'offcanvas-nav-open',
    ]) {
      expect(hostOverlayOpen(cls, '/products/peace')).toBe(true);
    }
  });

  it('still detects an open cart drawer (existing behavior)', () => {
    expect(hostOverlayOpen('cart-drawer-open', '/products/peace')).toBe(true);
    expect(hostOverlayOpen('CART-SIDEBAR-SHOW', '/products/peace')).toBe(true);
  });

  it('treats the cart page path as open', () => {
    expect(hostOverlayOpen('', '/cart')).toBe(true);
    expect(hostOverlayOpen('', '/cart/')).toBe(true);
  });

  it('returns false when no drawer/menu marker is present', () => {
    expect(hostOverlayOpen('template-product main-content', '/products/peace')).toBe(false);
    expect(hostOverlayOpen('', '/')).toBe(false);
  });

  it('does not false-positive on unrelated words containing "menu" substrings', () => {
    // a plain "menu" class (closed nav) must not hide the widget — only explicit
    // open-state markers should.
    expect(hostOverlayOpen('site-menu header', '/')).toBe(false);
  });
});
