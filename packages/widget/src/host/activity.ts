import type { WidgetMessage } from '../transport/codec.js';

export type ActivityTrackerArgs = {
  sessionId: string;
  hints: Map<string, string>;          // intentKey → selector, lower-cased keys
  send: (msg: WidgetMessage) => void;
};

const MAX_EVENT_RATE_MS = 200;

export function startActivityTracker(args: ActivityTrackerArgs): () => void {
  let lastEventAt = 0;
  const emit = (msg: WidgetMessage) => {
    const now = Date.now();
    if (now - lastEventAt < MAX_EVENT_RATE_MS) return;
    lastEventAt = now;
    args.send(msg);
  };

  const onClick = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const label = labelFor(target);
    const intentKey = label ? matchHintKey(label, args.hints) : null;
    emit({
      type: 'visitor_action', sessionId: args.sessionId, action: 'click',
      intentKey, url: window.location.href, elementLabel: label, timestamp: Date.now(),
    });
  };

  const onRouteChange = () => {
    emit({
      type: 'visitor_action', sessionId: args.sessionId, action: 'route_change',
      intentKey: null, url: window.location.href, elementLabel: null, timestamp: Date.now(),
    });
  };

  const onFocus = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName?.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
    const inputType = (target as HTMLInputElement).type;
    if (inputType === 'password') return; // never even acknowledge focus on passwords
    emit({
      type: 'visitor_action', sessionId: args.sessionId, action: 'form_focus',
      intentKey: null, url: window.location.href,
      elementLabel: (target as HTMLInputElement).name || target.id || null,
      timestamp: Date.now(),
    });
  };

  document.addEventListener('click', onClick, { passive: true, capture: true });
  window.addEventListener('popstate', onRouteChange);
  document.addEventListener('focusin', onFocus, { passive: true });

  return () => {
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('popstate', onRouteChange);
    document.removeEventListener('focusin', onFocus);
  };
}

function labelFor(el: HTMLElement): string | null {
  return el.getAttribute('aria-label')
      ?? el.getAttribute('title')
      ?? (el.textContent ?? '').trim().slice(0, 80)
      ?? null;
}

function matchHintKey(label: string, hints: Map<string, string>): string | null {
  const lower = label.toLowerCase();
  if (hints.has(lower)) return lower;
  for (const key of hints.keys()) {
    if (lower.includes(key) || key.includes(lower)) return key;
  }
  return null;
}
