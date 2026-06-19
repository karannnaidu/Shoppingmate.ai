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
    // Prefer a stable data-sm-field anchor (the brand tags its checkout inputs
    // with these) for deterministic, reliable resolution; fall back to the
    // accessible-name/label heuristic for generic pages.
    let el: HTMLElement | null = null;
    try {
      el = document.querySelector<HTMLElement>(`[data-sm-field="${CSS.escape(field)}"]`);
    } catch {
      el = null;
    }
    if (!el) el = resolveField(field, hints);
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
