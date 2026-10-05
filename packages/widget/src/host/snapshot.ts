import { accessibleName, isVisible } from './ax-tree.js';
import { keyFor } from './fingerprint.js';

// Compact, model-readable snapshot of the live page (nav PRD Phase 1).
//
// Instead of raw DOM or screenshots, the bot gets an accessibility-style list of
// what matters on screen — buttons, links, form controls, headings, prices,
// open dialogs — each with a short stable ref ([e12]) it can act on:
//
//   [page] Sleep Mantra · /shop/sleep-mantra
//   [e3] heading "Sleep Mantra"
//   [e7] radio "50 ml" (checked)
//   [e9] text "₹649"
//   [e12] button "Add to cart"
//
// Refs live only in this module's map and stay valid until the next snapshot.

const REF_ATTR = 'data-sm-ref';
const DEFAULT_MAX_CHARS = 6000; // ≈1.5k tokens

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="combobox"]',
].join(',');

const CONTEXT_SELECTOR = 'h1,h2,h3,[role="heading"],[role="alert"],[role="status"]';
const DIALOG_SELECTOR = 'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const PRICE_RE =
  /(₹|\$|£|€|Rs\.?\s?|INR\s?|USD\s?|AED\s?)\s?\d[\d,]*(\.\d+)?|\d[\d,]*(\.\d+)?\s?(₹|\$|£|€)/;

let refMap = new Map<string, HTMLElement>();

export type Snapshot = { text: string; refs: number; chars: number; truncated: number };

type Entry = { el: HTMLElement; line: string; priority: number; order: number };

/** Is this element one of ours (widget, cursor, pulse ring)? */
export function isOwnNode(node: Node | null): boolean {
  let el: Node | null = node;
  while (el) {
    if (el instanceof Element) {
      if (el.tagName === 'SHOPPINGMATE-WIDGET') return true;
      for (const a of Array.from(el.attributes)) {
        if (a.name.startsWith('data-shoppingmate')) return true;
      }
    }
    el = el.parentNode;
  }
  return false;
}

function hiddenByAria(el: HTMLElement): boolean {
  return el.closest('[aria-hidden="true"],[inert]') !== null;
}

// Real browsers: an element with no layout boxes (display:none ancestor, a
// responsive duplicate hidden at this breakpoint) is not on screen. Test DOMs
// (happy-dom) report no layout at all, so the check only applies when the page
// itself has layout.
function hasLayout(): boolean {
  return (document.body?.getBoundingClientRect().width ?? 0) > 0;
}
function rendered(el: HTMLElement, layout: boolean): boolean {
  if (!layout) return true;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

function roleOf(el: HTMLElement): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    const t = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (t === 'radio' || t === 'checkbox') return t;
    if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
    if (t === 'number') return 'spinbutton';
    return 'textbox';
  }
  return tag;
}

function controlName(el: HTMLElement): string {
  const name = accessibleName(el);
  if (name) return name;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    const wrapping = el.closest('label')?.textContent?.trim();
    if (wrapping) return wrapping;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.placeholder || el.name || '';
  }
  if (el instanceof HTMLSelectElement) return el.name || '';
  return '';
}

function clean(s: string, max = 80): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

function states(el: HTMLElement, role: string): string[] {
  const out: string[] = [];
  if (el instanceof HTMLInputElement && (role === 'radio' || role === 'checkbox')) {
    if (el.checked) out.push('checked');
  } else if (el.getAttribute('aria-checked') === 'true') out.push('checked');
  if (el.getAttribute('aria-selected') === 'true') out.push('selected');
  if (el.getAttribute('aria-pressed') === 'true') out.push('pressed');
  const expanded = el.getAttribute('aria-expanded');
  if (expanded === 'true') out.push('expanded');
  if (expanded === 'false') out.push('collapsed');
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true')
    out.push('disabled');
  if (el instanceof HTMLInputElement && role !== 'radio' && role !== 'checkbox') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'password') {
      if (el.value) out.push('filled');
    } else if (el.value) {
      out.push(`value="${clean(el.value, 40)}"`);
    }
  }
  if (el instanceof HTMLTextAreaElement && el.value) out.push(`value="${clean(el.value, 40)}"`);
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    if (opt) out.push(`value="${clean(opt.textContent ?? '', 40)}"`);
  }
  return out;
}

/** Elements far below the fold are lower priority than what's on screen. */
function nearViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0 && r.top === 0) return true; // test envs report 0×0
  const vh = window.innerHeight || 800;
  return r.bottom > -vh && r.top < vh * 2;
}

function inChrome(el: HTMLElement): boolean {
  return el.closest('footer,[role="contentinfo"]') !== null;
}

function collectScope(): HTMLElement[] {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)).filter(
    (d) => isVisible(d) && !isOwnNode(d),
  );
  return dialogs;
}

function looksLikePrice(el: HTMLElement): boolean {
  if (el.children.length > 0) return false;
  const text = (el.textContent ?? '').trim();
  if (!text || text.length > 40) return false;
  return PRICE_RE.test(text);
}

export type SnapshotOptions = {
  maxChars?: number;
  /** Phase 2: template skeleton keys — static header/footer links in it are
   *  collapsed into one summary line instead of individual refs. */
  collapse?: Set<string>;
  /** Phase 2: extra lines after the [page] header (template + recipes). */
  preface?: string[];
};

export function buildSnapshot(opts: SnapshotOptions = {}): Snapshot {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const collapsedNames: string[] = [];
  for (const el of Array.from(document.querySelectorAll(`[${REF_ATTR}]`)))
    el.removeAttribute(REF_ATTR);
  refMap = new Map();

  const dialogs = collectScope();
  const entries: Entry[] = [];
  const seen = new Set<HTMLElement>();
  let order = 0;

  const layout = hasLayout();
  const consider = (
    el: HTMLElement,
    kind: 'interactive' | 'context' | 'price',
    inDialog: boolean,
  ) => {
    if (seen.has(el) || isOwnNode(el) || !isVisible(el) || hiddenByAria(el)) return;
    if (!rendered(el, layout)) return;
    if (el instanceof HTMLInputElement && el.type === 'hidden') return;
    seen.add(el);
    const role = kind === 'price' ? 'text' : roleOf(el);
    const name = kind === 'price' ? clean(el.textContent ?? '', 40) : clean(controlName(el));
    const st = kind === 'price' ? [] : states(el, role);
    if (!name && st.length === 0 && kind !== 'interactive') return;
    // Unlabelled icon-only links/buttons add noise the bot can't act on sensibly.
    if (!name && kind === 'interactive' && (role === 'link' || role === 'button')) return;
    const footer = !inDialog && inChrome(el);
    const navbar = !inDialog && el.closest('nav,header,[role="navigation"],[role="banner"]') !== null;
    if (opts.collapse && role === 'link' && (footer || navbar)) {
      const k = keyFor(role, name);
      if (k && opts.collapse.has(k)) {
        // Short nav labels only — addresses / phone numbers / long footer text
        // are dropped from the summary line (they're never navigation targets).
        if (collapsedNames.length < 12 && name.length <= 24 && !/\d{3}|@/.test(name) && !collapsedNames.includes(name)) {
          collapsedNames.push(name);
        }
        return;
      }
    }
    let priority = inDialog ? 0 : kind === 'interactive' ? 2 : kind === 'context' ? 1 : 2;
    if (!inDialog && !nearViewport(el)) priority += 3;
    if (footer) priority += 4;
    if (navbar) priority += 2;
    const stateText = st.length > 0 ? ` (${st.join(', ')})` : '';
    const line = `${role} "${name}"${stateText}`;
    entries.push({ el, line, priority, order: order++ });
  };

  for (const d of dialogs) {
    const label = clean(accessibleName(d) || 'dialog', 60);
    entries.push({ el: d, line: `dialog "${label}" (open)`, priority: 0, order: order++ });
    seen.add(d);
    for (const el of Array.from(
      d.querySelectorAll<HTMLElement>(`${INTERACTIVE_SELECTOR},${CONTEXT_SELECTOR}`),
    )) {
      consider(el, el.matches(INTERACTIVE_SELECTOR) ? 'interactive' : 'context', true);
    }
  }

  const root = document.querySelector<HTMLElement>('main,[role="main"]') ?? document.body;
  const scopes = root === document.body ? [document.body] : [root, document.body];
  for (const scope of scopes) {
    for (const el of Array.from(
      scope.querySelectorAll<HTMLElement>(`${INTERACTIVE_SELECTOR},${CONTEXT_SELECTOR}`),
    )) {
      consider(el, el.matches(INTERACTIVE_SELECTOR) ? 'interactive' : 'context', false);
    }
  }
  let prices = 0;
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>('span,div,p,strong,b,s,del,ins,bdi'),
  )) {
    if (prices >= 15) break;
    if (!looksLikePrice(el)) continue;
    const before = entries.length;
    consider(el, 'price', false);
    if (entries.length > before) prices += 1;
  }

  // Keep the most important lines within the budget, then restore page order.
  const header = [`[page] ${clean(document.title || '', 70)} · ${location.pathname}`, ...(opts.preface ?? [])];
  if (collapsedNames.length > 0) {
    header.push(`[site links] ${collapsedNames.join(', ')} (standard site navigation — use site.navigate)`);
  }
  const ranked = [...entries].sort((a, b) => a.priority - b.priority || a.order - b.order);
  const kept: Entry[] = [];
  let used = header.join('\n').length + 1;
  for (const e of ranked) {
    const cost = e.line.length + 8;
    if (used + cost > maxChars) continue;
    kept.push(e);
    used += cost;
  }
  kept.sort((a, b) => a.order - b.order);

  const lines = [...header];
  let n = 0;
  for (const e of kept) {
    n += 1;
    const ref = `e${n}`;
    e.el.setAttribute(REF_ATTR, ref);
    refMap.set(ref, e.el);
    lines.push(`[${ref}] ${e.line}`);
  }
  const truncated = entries.length - kept.length;
  if (truncated > 0)
    lines.push(`… ${truncated} more elements not shown (lower on the page or in the footer)`);
  const text = lines.join('\n');
  return { text, refs: n, chars: text.length, truncated };
}

/** Resolve a ref from the latest snapshot to its live element, or null if gone. */
export function elementForRef(ref: string): HTMLElement | null {
  const key = ref.replace(/^\[|\]$/g, '').trim();
  const el = refMap.get(key);
  if (el?.isConnected) return el;
  // The map may be from before a re-render; fall back to the attribute.
  try {
    const byAttr = document.querySelector<HTMLElement>(`[${REF_ATTR}="${CSS.escape(key)}"]`);
    return byAttr?.isConnected ? byAttr : null;
  } catch {
    return null;
  }
}
