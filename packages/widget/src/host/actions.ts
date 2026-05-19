import { resolveIntent } from './ax-tree.js';
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

function navigate(path: string): HostActionResult {
  try {
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) {
      return { ok: false, reason: 'cross_origin' };
    }
    window.location.assign(url.pathname + url.search + url.hash);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'route_not_found' };
  }
}

function scrollTo(intent: string): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return { ok: true };
}

function highlight(intent: string, durationMs: number): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  showPulseRing(el, durationMs);
  return { ok: true };
}

function click(intent: string): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  el.click();
  return { ok: true };
}
