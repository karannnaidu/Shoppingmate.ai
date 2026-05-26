import { resolveIntent } from './ax-tree.js';
import { hideCursor, moveCursorTo, pulseCursorClick } from './cursor.js';
import { showPulseRing } from './overlay.js';

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string };

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
