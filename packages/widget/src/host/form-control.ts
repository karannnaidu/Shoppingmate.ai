import { resolveField } from './ax-tree.js';
import type { HostActionResult } from './actions.js';

type FillableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// Controlled React inputs ignore `el.value = x`; set via the native prototype
// setter and dispatch the events React listens for, so the store updates.
export function setReactValue(el: FillableEl, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function readFieldValue(el: HTMLElement): string {
  return (el as FillableEl).value ?? '';
}

// Learn-once selector cache: after a field resolves, we remember a DURABLE
// selector for it (keyed by page path) so later fills are a direct lookup with
// NO DOM crawl. If the cached selector stops matching (layout changed / the
// element is gone), we re-resolve and re-learn (heal). Persisted to localStorage
// so the learned layout survives across sessions for the same page.
const SELECTOR_CACHE_KEY = 'sm_selector_cache_v1';
type SelectorCache = Record<string, string>;

function loadSelectorCache(): SelectorCache {
  try {
    return JSON.parse(localStorage.getItem(SELECTOR_CACHE_KEY) ?? '{}') as SelectorCache;
  } catch {
    return {};
  }
}
function saveSelectorCache(c: SelectorCache): void {
  try {
    localStorage.setItem(SELECTOR_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota/availability */
  }
}
function cacheKeyFor(field: string): string {
  return `${location.pathname}::${field}`;
}
// A stable selector for a resolved element: data-sm-field > id > name. Null if
// none — then we don't cache (can't form a durable selector; resolve live).
function durableSelector(el: HTMLElement): string | null {
  const sm = el.getAttribute('data-sm-field');
  if (sm) return `[data-sm-field="${CSS.escape(sm)}"]`;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const name = el.getAttribute('name');
  if (name) return `[name="${CSS.escape(name)}"]`;
  return null;
}

// Resolve a field, preferring the learned selector. Cache hit + element present
// → direct, no crawl. Miss or stale → resolve (data-sm-field, then ax-tree) and
// (re)learn a durable selector.
export function resolveFieldCached(field: string, hints?: Map<string, string>): HTMLElement | null {
  const cache = loadSelectorCache();
  const key = cacheKeyFor(field);
  const cached = cache[key];
  if (cached) {
    try {
      const hit = document.querySelector<HTMLElement>(cached);
      if (hit?.isConnected) return hit; // learned the layout — no crawl
    } catch {
      /* malformed cached selector → fall through and re-learn */
    }
  }
  let el: HTMLElement | null = null;
  try {
    el = document.querySelector<HTMLElement>(`[data-sm-field="${CSS.escape(field)}"]`);
  } catch {
    el = null;
  }
  if (!el) el = resolveField(field, hints); // the only path that crawls
  if (el) {
    const sel = durableSelector(el);
    if (sel) {
      cache[key] = sel;
      saveSelectorCache(cache);
    }
  }
  return el;
}

// Fill many fields by intent. Returns the values ACTUALLY in the fields after
// filling (the read-back). ok:false only if NOT ONE field resolved.
export function formFill(
  fields: Array<{ field: string; value: string }>,
  hints?: Map<string, string>,
): HostActionResult {
  const values: Record<string, string> = {};
  const filled: Array<{ field: string; ok: boolean; value: string }> = [];
  let anyResolved = false;
  for (const { field, value } of fields) {
    // Learn-once resolution: cached selector (no crawl) → data-sm-field anchor →
    // ax-tree heuristic; the result is cached so we don't crawl again until the
    // layout changes and the cached selector fails.
    const el = resolveFieldCached(field, hints);
    if (!el) {
      filled.push({ field, ok: false, value: '' });
      continue;
    }
    anyResolved = true;
    setReactValue(el as FillableEl, value);
    const actual = readFieldValue(el);
    values[field] = actual;
    filled.push({ field, ok: actual === value, value: actual });
  }
  if (!anyResolved) return { ok: false, reason: 'not_found' };
  return { ok: true, values, filled };
}

// Read current values of named fields (or all visible form controls if omitted).
export function formRead(fields?: string[], hints?: Map<string, string>): HostActionResult {
  const values: Record<string, string> = {};
  if (fields && fields.length > 0) {
    for (const field of fields) {
      const el = resolveField(field, hints);
      if (el) values[field] = readFieldValue(el);
    }
    return { ok: true, values };
  }
  const controls = document.querySelectorAll<HTMLElement>('input, textarea, select');
  for (const el of controls) {
    // Never surface sensitive/non-visible fields to the model on a bare read.
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (type === 'password' || type === 'hidden') continue;
    const name = el.getAttribute('name') ?? el.id;
    if (name) values[name] = readFieldValue(el);
  }
  return { ok: true, values };
}
