import { resolveIntent } from './ax-tree.js';
import { hideCursor, moveCursorTo, pulseCursorClick } from './cursor.js';
import { showPulseRing } from './overlay.js';

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string }
  | { type: 'point_at'; intent: string }
  | { type: 'demo_click'; intent: string }
  | { type: 'cart_add'; sku: string; qty: number }
  | { type: 'open_cart' };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' };

export async function executeHostAction(action: HostAction): Promise<HostActionResult> {
  switch (action.type) {
    case 'navigate':
      return navigate(action.path);
    case 'scroll_to':
      return scrollTo(action.intent);
    case 'highlight':
      return highlight(action.intent, action.durationMs ?? 2000);
    case 'click':
      return click(action.intent);
    case 'point_at':
      return pointAt(action.intent);
    case 'demo_click':
      return demoClick(action.intent);
    case 'cart_add':
      return cartAdd(action.sku, action.qty);
    case 'open_cart':
      return openCart();
  }
}

// Calmosis storefront exposes window.__shoppingmateCartAdd__(sku, qty) (returns
// boolean) and window.__shoppingmateOpenCart__(). Drive the REAL cart through
// them — no DOM scraping. If the hook isn't present, report not_found.
type CartAddHook = (sku: string, qty?: number) => boolean;
type OpenCartHook = () => void;

function cartAdd(sku: string, qty: number): HostActionResult {
  const fn = (window as unknown as { __shoppingmateCartAdd__?: CartAddHook }).__shoppingmateCartAdd__;
  if (typeof fn !== 'function') return { ok: false, reason: 'not_found' };
  try {
    return fn(sku, qty) ? { ok: true } : { ok: false, reason: 'not_found' };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

function openCart(): HostActionResult {
  const fn = (window as unknown as { __shoppingmateOpenCart__?: OpenCartHook }).__shoppingmateOpenCart__;
  if (typeof fn !== 'function') return { ok: false, reason: 'not_found' };
  try {
    fn();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'not_found' };
  }
}

// Next.js (and other client routers) expose nothing globally by default, but
// host pages can opt in by setting window.__shoppingmateNavigate__. When
// present we use it so cross-route nav doesn't hard-reload the page (slow,
// loses widget state). Otherwise fall back to window.location.assign.
type ClientNav = (path: string) => void;
function clientRouterNavigate(path: string): boolean {
  const fn = (window as unknown as { __shoppingmateNavigate__?: ClientNav })
    .__shoppingmateNavigate__;
  if (typeof fn === 'function') {
    try {
      fn(path);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}


async function navigate(path: string): Promise<HostActionResult> {
  try {
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) {
      return { ok: false, reason: 'cross_origin' };
    }
    // Try to find a target nav link so the cursor can drive to it visibly.
    const navTarget = findNavLink(url.pathname);
    if (navTarget) {
      await moveCursorTo(navTarget, 520);
      await pulseCursorClick();
    }
    const dest = url.pathname + url.search + url.hash;
    if (!clientRouterNavigate(dest)) {
      window.location.assign(dest);
    }
    hideCursor(800);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'route_not_found' };
  }
}

function findNavLink(pathname: string): HTMLElement | null {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const a of links) {
    try {
      const href = new URL(a.href, window.location.href);
      if (href.pathname === pathname) return a;
    } catch {
      // ignore malformed hrefs
    }
  }
  return null;
}

async function scrollTo(intent: string): Promise<HostActionResult> {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  await moveCursorTo(el, 480);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  hideCursor(800);
  return { ok: true };
}

function highlight(intent: string, durationMs: number): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  showPulseRing(el, durationMs);
  return { ok: true };
}

async function click(intent: string): Promise<HostActionResult> {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  await moveCursorTo(el, 420);
  await pulseCursorClick();
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  el.click();
  hideCursor(800);
  return { ok: true };
}

// Scroll the target into view if it's outside the viewport, then wait briefly
// for the scroll to settle before measuring its position. Without this, the
// cursor lands at the pre-scroll coordinates and the visitor never sees it.
async function ensureInViewport(el: HTMLElement): Promise<void> {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const offscreen = rect.bottom < 80 || rect.top > vh - 80;
  if (!offscreen) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise<void>((resolve) => setTimeout(resolve, 350));
}

async function pointAt(intent: string): Promise<HostActionResult> {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  await ensureInViewport(el);
  await moveCursorTo(el, 480);
  return { ok: true };
}

async function demoClick(intent: string): Promise<HostActionResult> {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  await ensureInViewport(el);
  await moveCursorTo(el, 420);
  await pulseCursorClick();
  // Brief settle before the real click so the visitor's eye registers the
  // pulse-then-action sequence; without it the page changes too fast.
  await new Promise<void>((resolve) => setTimeout(resolve, 120));
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  el.click();
  hideCursor(800);
  return { ok: true };
}
