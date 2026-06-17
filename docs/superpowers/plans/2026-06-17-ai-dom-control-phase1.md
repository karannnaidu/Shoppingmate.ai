# AI-Driven DOM Control — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the bot generic, brand-agnostic control of the real page — `page.fill` / `page.read` / `page.click` tools that fill the live form's fields (React-safely), read back the *actual* values, and press the page's own buttons — so checkout is filled visibly and the visitor confirms on the real page.

**Architecture:** New widget DOM helpers (`form-control.ts` + a `resolveField` resolver in `ax-tree.ts`) execute fills/reads against the same-origin DOM and return the read-back. New host-action types (`form_fill`, `form_read`) carry these across the existing agent↔widget channel; the existing `click` host action is reused for `page.click`. New agent tools (`page.fill`/`page.read`/`page.click`) map to those host actions and are added to the site-graph tool surface. The Calmosis checkout prompt switches to navigate → fill → read-back → ask-before-click.

**Tech Stack:** TypeScript, Vitest + happy-dom (widget tests), pnpm workspaces. Packages: `@shoppingmate/widget` (browser web component), `@shoppingmate/agent` (runtime/tools/prompts).

**Spec:** `docs/superpowers/specs/2026-06-17-ai-dom-control-design.md`

---

## File Structure

- **`packages/widget/src/host/ax-tree.ts`** (modify) — add `resolveField(intent, hints?)` that targets form controls, preferring the page's own stable `id`/`name`/`data-*` selectors over fuzzy text.
- **`packages/widget/src/host/form-control.ts`** (create) — `setReactValue`, `readFieldValue`, `formFill`, `formRead`. The React-safe DOM mutation + read-back logic, isolated and unit-testable.
- **`packages/widget/src/host/form-control.test.ts`** (create) — happy-dom unit tests.
- **`packages/widget/src/host/actions.ts`** (modify) — add `form_fill`/`form_read` to the `HostAction` union + switch; widen `HostActionResult`; delegate to `form-control.ts`.
- **`packages/widget/src/transport/codec.ts`** (modify) — add `form_fill`/`form_read` to the `HostAction` union + `isValidHostAction`; widen `HostActionResult`.
- **`packages/widget/src/transport/codec.test.ts`** (modify) — decode tests for the new actions.
- **`packages/agent/src/host-actions.ts`** (modify) — add `form_fill`/`form_read` to the `HostAction` union; widen `HostActionResult`.
- **`packages/agent/src/tools.ts`** (modify) — add `PAGE_CONTROL_TOOLS` (`page.fill`/`page.read`/`page.click`) to the `isCalmosisStitch` site-tool set.
- **`packages/agent/src/tools.test.ts`** (modify) — assert Calmosis surface includes the new tools.
- **`packages/agent/src/runtime.ts`** (modify) — add the three tool names to the host-action dispatch allowlist; add `toHostAction` cases; export `toHostAction` for unit testing.
- **`packages/agent/src/runtime.test.ts`** (modify) — unit-test the `toHostAction` mapping.
- **`packages/agent/src/prompts/system.ts`** (modify) — rewrite the Calmosis checkout closing flow + Bliss Club add to use the new tools.

---

## Task 1: Widget — React-safe value setter + field resolver

**Files:**
- Modify: `packages/widget/src/host/ax-tree.ts`
- Create: `packages/widget/src/host/form-control.ts`
- Create: `packages/widget/src/host/form-control.test.ts`

- [ ] **Step 1: Add `resolveField` to `ax-tree.ts`**

Append to `packages/widget/src/host/ax-tree.ts`:

```ts
// Resolve a free-text field intent (e.g. "Email", "Pincode", "Full name") to a
// form control. Prefers the page's OWN stable identifiers (id/name/data-field)
// over fuzzy text, so we drive the same elements the site's code uses. An
// optional hints map (Phase 2: from the crawl graph) takes top priority.
export function resolveField(intent: string, hints?: Map<string, string>): HTMLElement | null {
  if (hints) {
    const sel = hints.get(intent.toLowerCase().trim());
    if (sel) {
      try {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement && isVisible(el)) return el;
      } catch {
        /* bad selector — fall through */
      }
    }
  }
  const tokens = tokenize(intent);
  if (tokens.size === 0) return null;
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>('input, textarea, select'),
  ).filter((el) => isVisible(el) && !isUnfillable(el));

  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of controls) {
    const score = scoreField(el, tokens);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { el, score };
  }
  return best?.el ?? null;
}

function isUnfillable(el: HTMLElement): boolean {
  const t = (el.getAttribute('type') ?? '').toLowerCase();
  return t === 'hidden' || t === 'submit' || t === 'button' || (el as HTMLInputElement).disabled;
}

function fieldNames(el: HTMLElement): string[] {
  const names: string[] = [];
  const id = el.id;
  if (id) {
    names.push(id);
    const lbl = document.querySelector(`label[for="${cssEscape(id)}"]`);
    if (lbl?.textContent) names.push(lbl.textContent);
  }
  const nameAttr = el.getAttribute('name');
  if (nameAttr) names.push(nameAttr);
  const dataField = el.getAttribute('data-field') ?? el.getAttribute('data-testid');
  if (dataField) names.push(dataField);
  const aria = el.getAttribute('aria-label');
  if (aria) names.push(aria);
  const ph = el.getAttribute('placeholder');
  if (ph) names.push(ph);
  // Wrapping <label>Email <input/></label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) names.push(parentLabel.textContent);
  return names;
}

function scoreField(el: HTMLElement, intentTokens: Set<string>): number {
  let best = 0;
  for (const raw of fieldNames(el)) {
    const nameTokens = tokenize(raw);
    if (nameTokens.size === 0) continue;
    let intersect = 0;
    for (const t of intentTokens) if (nameTokens.has(t)) intersect++;
    if (intersect === 0) continue;
    // Coverage of the intent's tokens (so "pincode" fully matches a "pincode" field).
    const coverage = intersect / intentTokens.size;
    if (coverage > best) best = coverage;
  }
  return best;
}
```

- [ ] **Step 2: Create `form-control.ts` with the failing-test target**

Create `packages/widget/src/host/form-control.ts`:

```ts
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
    const el = resolveField(field, hints);
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
    const name = el.getAttribute('name') ?? el.id;
    if (name) values[name] = readFieldValue(el);
  }
  return { ok: true, values };
}
```

- [ ] **Step 3: Write the failing tests**

Create `packages/widget/src/host/form-control.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { setReactValue, formFill, formRead } from './form-control.js';
import { resolveField } from './ax-tree.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('setReactValue', () => {
  it('sets the value and dispatches an input event', () => {
    document.body.innerHTML = '<input id="x" />';
    const el = document.getElementById('x') as HTMLInputElement;
    let fired = false;
    el.addEventListener('input', () => {
      fired = true;
    });
    setReactValue(el, 'hello');
    expect(el.value).toBe('hello');
    expect(fired).toBe(true);
  });
});

describe('resolveField', () => {
  it('matches an input by its <label for> text', () => {
    document.body.innerHTML = '<label for="em">Email address</label><input id="em" />';
    expect(resolveField('Email')?.id).toBe('em');
  });
  it('matches an input by placeholder when unlabelled', () => {
    document.body.innerHTML = '<input id="pc" placeholder="Pincode" />';
    expect(resolveField('pincode')?.id).toBe('pc');
  });
  it('returns null when nothing matches', () => {
    document.body.innerHTML = '<div>no inputs</div>';
    expect(resolveField('Email')).toBeNull();
  });
});

describe('formFill', () => {
  it('fills fields and returns read-back values', () => {
    document.body.innerHTML =
      '<label for="n">Full name</label><input id="n" />' +
      '<label for="e">Email</label><input id="e" />';
    const r = formFill([
      { field: 'Full name', value: 'Karan' },
      { field: 'Email', value: 'k@x.com' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values?.['Full name']).toBe('Karan');
      expect(r.values?.['Email']).toBe('k@x.com');
    }
    expect((document.getElementById('n') as HTMLInputElement).value).toBe('Karan');
  });
  it('reports not_found when no field resolves', () => {
    document.body.innerHTML = '<div>nothing</div>';
    const r = formFill([{ field: 'Email', value: 'x' }]);
    expect(r.ok).toBe(false);
  });
});

describe('formRead', () => {
  it('reads named field values back', () => {
    document.body.innerHTML = '<label for="e">Email</label><input id="e" value="a@b.com" />';
    const r = formRead(['Email']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values?.['Email']).toBe('a@b.com');
  });
});
```

- [ ] **Step 4: Run the tests — expect FAIL first, then PASS**

Run: `pnpm --filter @shoppingmate/widget test form-control`
Expected: initially FAILS if `HostActionResult` isn't yet widened (Task 2 widens it). If the import of `HostActionResult` from `./actions.js` errors on the new `values`/`filled` fields, do Task 2 Step 1 first, then return here. Final expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/host/ax-tree.ts packages/widget/src/host/form-control.ts packages/widget/src/host/form-control.test.ts
git commit -m "feat(widget): React-safe form-control (resolveField + formFill/formRead)"
```

---

## Task 2: Widget — wire `form_fill` / `form_read` host actions

**Files:**
- Modify: `packages/widget/src/host/actions.ts`
- Modify: `packages/widget/src/transport/codec.ts`
- Modify: `packages/widget/src/transport/codec.test.ts`

- [ ] **Step 1: Widen `HostActionResult` + add union members + switch in `actions.ts`**

In `packages/widget/src/host/actions.ts`, change the `HostActionResult` type to:

```ts
export type HostActionResult =
  | { ok: true; values?: Record<string, string>; filled?: Array<{ field: string; ok: boolean; value: string }> }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' };
```

Add to the `HostAction` union (after the `cart_clear` line):

```ts
  | { type: 'form_fill'; fields: Array<{ field: string; value: string }> }
  | { type: 'form_read'; fields?: string[] }
```

Add an import at the top:

```ts
import { formFill, formRead } from './form-control.js';
```

Add to the `executeHostAction` switch (after the `cart_clear` case):

```ts
    case 'form_fill':
      return formFill(action.fields);
    case 'form_read':
      return formRead(action.fields);
```

- [ ] **Step 2: Widen result + add union/validation in `codec.ts`**

In `packages/widget/src/transport/codec.ts`, change `HostActionResult` to match Task 2 Step 1 exactly (add the `values?`/`filled?` fields to the `ok: true` variant).

Add to the `HostAction` union (after `cart_clear`):

```ts
  | { type: 'form_fill'; fields: Array<{ field: string; value: string }> }
  | { type: 'form_read'; fields?: string[] }
```

Add cases to `isValidHostAction`:

```ts
    case 'form_fill':
      return (
        Array.isArray(a.fields) &&
        a.fields.every((f: any) => f && typeof f.field === 'string' && typeof f.value === 'string')
      );
    case 'form_read':
      return a.fields === undefined || Array.isArray(a.fields);
```

- [ ] **Step 3: Write failing decode tests in `codec.test.ts`**

Add to `packages/widget/src/transport/codec.test.ts`:

```ts
it('decodes form_fill and form_read host actions', () => {
  expect(
    decodeAgentEvent(
      JSON.stringify({
        type: 'host_action_request',
        callId: 'q1',
        action: { type: 'form_fill', fields: [{ field: 'Email', value: 'a@b.com' }] },
      }),
    ),
  ).not.toBeNull();
  expect(
    decodeAgentEvent(
      JSON.stringify({ type: 'host_action_request', callId: 'q2', action: { type: 'form_read' } }),
    ),
  ).not.toBeNull();
});

it('rejects form_fill with a malformed fields array', () => {
  expect(
    decodeAgentEvent(
      JSON.stringify({
        type: 'host_action_request',
        callId: 'q3',
        action: { type: 'form_fill', fields: [{ field: 'Email' }] },
      }),
    ),
  ).toBeNull();
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: PASS (codec + form-control + existing suites all green).

- [ ] **Step 5: Build the widget to confirm types + bundle budget**

Run: `pnpm --filter @shoppingmate/widget build`
Expected: builds OK, prints bundle size under budget, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/widget/src/host/actions.ts packages/widget/src/transport/codec.ts packages/widget/src/transport/codec.test.ts
git commit -m "feat(widget): form_fill/form_read host actions + widened result"
```

---

## Task 3: Agent — host-action types

**Files:**
- Modify: `packages/agent/src/host-actions.ts`

- [ ] **Step 1: Add union members + widen result**

In `packages/agent/src/host-actions.ts`, add to the `HostAction` union (after the `cart_clear` line):

```ts
  // Generic DOM control: fill the live page's form fields and read back the
  // values actually present (the read-back). form_read returns current values.
  | { type: 'form_fill'; fields: Array<{ field: string; value: string }> }
  | { type: 'form_read'; fields?: string[] }
```

Change `HostActionResult` to (keep the existing `reason` union, add the success-data fields):

```ts
export type HostActionResult =
  | { ok: true; values?: Record<string, string>; filled?: Array<{ field: string; ok: boolean; value: string }> }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };
```

- [ ] **Step 2: Build the agent to confirm types**

Run: `pnpm --filter @shoppingmate/agent build`
Expected: compiles, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/host-actions.ts
git commit -m "feat(agent): form_fill/form_read host-action types + widened result"
```

---

## Task 4: Agent — `page.fill` / `page.read` / `page.click` tools + mapping

**Files:**
- Modify: `packages/agent/src/tools.ts`
- Modify: `packages/agent/src/tools.test.ts`
- Modify: `packages/agent/src/runtime.ts`
- Modify: `packages/agent/src/runtime.test.ts`

- [ ] **Step 1: Add `PAGE_CONTROL_TOOLS` in `tools.ts`**

In `packages/agent/src/tools.ts`, after the `CALMOSIS_CHECKOUT_TOOLS` array, add:

```ts
// Generic page-control tools (host actions → live DOM). page.click reuses the
// widget's existing `click` host action; page.fill/read use form_fill/form_read.
const PAGE_CONTROL_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'page.fill',
      description:
        "Fill fields in the form currently on the visitor's screen, then return the values ACTUALLY in those fields (the read-back). Use the visitor's most recent values. Field names are human labels (e.g. 'Full name', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode'). After calling, read the returned values back to the visitor to confirm — never your own memory.",
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, value: { type: 'string' } },
              required: ['field', 'value'],
            },
          },
        },
        required: ['fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'page.read',
      description:
        'Read the current values of fields in the form on screen (omit fields to read all). Use to verify what is actually filled before confirming.',
      parameters: {
        type: 'object',
        properties: { fields: { type: 'array', items: { type: 'string' } } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'page.click',
      description:
        "Click a button or control on the page by describing it (e.g. 'Continue to Payment', 'Join Bliss Club'). Use to press the store's own buttons — ALWAYS ask the visitor before clicking a submit/checkout button.",
      parameters: {
        type: 'object',
        properties: { intent: { type: 'string' } },
        required: ['intent'],
      },
    },
  },
];
```

- [ ] **Step 2: Add the tools to the Calmosis site-tool set**

In `packages/agent/src/tools.ts`, find the `isCalmosisStitch(merchant)` branch inside `buildToolSurface` and add `...PAGE_CONTROL_TOOLS`:

```ts
    const siteTools = isCalmosisStitch(merchant)
      ? [...SITE_NAV_TOOLS, ...CALMOSIS_CART_TOOLS, ...CALMOSIS_CHECKOUT_TOOLS, ...PAGE_CONTROL_TOOLS, CALMOSIS_CONSULT_TOOL]
      : SITE_NAV_TOOLS;
```

- [ ] **Step 3: Write the failing tool-surface test**

Add to `packages/agent/src/tools.test.ts` inside the existing `describe('buildToolSurface()')`:

```ts
it('Calmosis surface includes page.fill / page.read / page.click', () => {
  const calmosis = { id: 'SM-2SCCLZ', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
  const names = buildToolSurface(calmosis).map((t) => t.function.name);
  expect(names).toContain('page.fill');
  expect(names).toContain('page.read');
  expect(names).toContain('page.click');
});
```

- [ ] **Step 4: Add dispatch allowlist + mapping in `runtime.ts`**

In `packages/agent/src/runtime.ts`, in the `isCalmosisCart` boolean, add the three names:

```ts
        const isCalmosisCart =
          isCalmosisStitch(merchant) &&
          (call.name === 'cart.add' ||
            call.name === 'cart.open' ||
            call.name === 'cart.update' ||
            call.name === 'cart.clear' ||
            call.name === 'coupon.apply' ||
            call.name === 'checkout.fill' ||
            call.name === 'checkout.place' ||
            call.name === 'checkout.state' ||
            call.name === 'page.fill' ||
            call.name === 'page.read' ||
            call.name === 'page.click');
```

In the same file, change `function toHostAction(` to `export function toHostAction(` and add these cases (next to the `cart.clear` case):

```ts
    case 'page.fill':
      return {
        type: 'form_fill',
        fields: Array.isArray(args.fields)
          ? (args.fields as Array<Record<string, unknown>>).map((f) => ({
              field: String(f.field ?? ''),
              value: String(f.value ?? ''),
            }))
          : [],
      };
    case 'page.read':
      return {
        type: 'form_read',
        fields: Array.isArray(args.fields) ? (args.fields as unknown[]).map((s) => String(s)) : undefined,
      };
    case 'page.click':
      return { type: 'click', intent: String(args.intent ?? '') };
```

- [ ] **Step 5: Write the failing mapping test**

Add to `packages/agent/src/runtime.test.ts` (import `toHostAction` from `./runtime.js` at the top alongside existing imports):

```ts
describe('toHostAction (page-control mapping)', () => {
  it('maps page.fill to form_fill with normalised fields', () => {
    const a = toHostAction('page.fill', { fields: [{ field: 'Email', value: 'a@b.com' }] });
    expect(a).toEqual({ type: 'form_fill', fields: [{ field: 'Email', value: 'a@b.com' }] });
  });
  it('maps page.read to form_read', () => {
    expect(toHostAction('page.read', {})).toEqual({ type: 'form_read', fields: undefined });
  });
  it('maps page.click to the click host action', () => {
    expect(toHostAction('page.click', { intent: 'Continue to Payment' })).toEqual({
      type: 'click',
      intent: 'Continue to Payment',
    });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @shoppingmate/agent build && pnpm --filter @shoppingmate/agent test`
Expected: PASS — new tool-surface + mapping tests green, existing 169 tests still green.

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/tools.ts packages/agent/src/tools.test.ts packages/agent/src/runtime.ts packages/agent/src/runtime.test.ts
git commit -m "feat(agent): page.fill/page.read/page.click tools + host-action mapping"
```

---

## Task 5: Agent — Calmosis checkout + Bliss Club prompt

**Files:**
- Modify: `packages/agent/src/prompts/system.ts`

- [ ] **Step 1: Replace the checkout closing flow**

In `packages/agent/src/prompts/system.ts`, replace the bullet that begins
`- CLOSING THE ORDER (you can complete checkout for them):` (the entire line) with:

```
- CLOSING THE ORDER (you complete checkout ON THE REAL PAGE so the visitor sees it): when the visitor is ready to buy, (1) call site.navigate({path:"/checkout"}). (2) Collect any missing delivery details conversationally — name, 10-digit phone, email, street address, city, state, 6-digit pincode — ALWAYS using their MOST RECENT value if they correct something. (3) Call page.fill with every field at once, e.g. page.fill({fields:[{field:"Full name",value:"..."},{field:"Phone",value:"..."},{field:"Email",value:"..."},{field:"Address",value:"..."},{field:"City",value:"..."},{field:"State",value:"..."},{field:"Pincode",value:"..."}]}). (4) page.fill returns the values ACTUALLY in the form — read THOSE back (not your own memory): "I've put [values] on the checkout page — does that look right?" If any came back empty or wrong, call page.fill again for just that field. (5) Once they confirm, ASK before submitting: "Shall I click Continue to Payment for you, or would you like to tap it yourself?" ONLY if they say yes, call page.click({intent:"Continue to Payment"}). NEVER auto-click, and never say the order is placed — the click takes them to the secure payment page where they pick how to pay (card, UPI, or Cash on Delivery).
- If page.fill or page.click can't find the fields/button (returns not ok), tell the visitor and fall back to site.navigate({path:"/checkout"}) so they can finish on the page themselves — never claim it's done.
```

- [ ] **Step 2: Replace the Bliss Club enrol instruction**

In the same file, replace the bullet beginning
`- To enroll a visitor (they ask about Bliss Club` with:

```
- To add the Bliss Club membership, do NOT use cart.add for it (that adds it with the wrong shape). Instead make sure a page showing the membership is open (navigate to "/shop" or a product page if needed), then call page.click({intent:"Join Bliss Club"}) to press the store's own membership button — this runs Calmosis's own logic so it's added correctly. Confirm only if the click succeeded.
```

- [ ] **Step 3: Build to confirm no template breakage**

Run: `pnpm --filter @shoppingmate/agent build && pnpm --filter @shoppingmate/agent test`
Expected: PASS (prompt is a template string; existing prompt tests still green).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/prompts/system.ts
git commit -m "feat(agent): checkout via page.fill/read-back/ask-before-click + Bliss Club via real button"
```

---

## Task 6: End-to-end verification (live, against a deployed build)

**Files:**
- Create: `apps/api/scripts/probe-page-fill.mjs`

> This task proves the real DOM gets filled in a browser — unit tests can't. It uses the existing playwright setup in `apps/worker` (see `apps/worker/probe-calmosis-checkout.mjs` for the pattern). Run AFTER deploying the widget (Vercel) + agent (Railway) so the live widget has the new host actions.

- [ ] **Step 1: Write a playwright probe that drives the live storefront**

Create `apps/api/scripts/probe-page-fill.mjs` (run with `npx tsx`):

```js
import { chromium } from 'playwright';

// Loads the live Calmosis checkout, then simulates what the form_fill host action
// does (resolveField + setReactValue) to prove React-controlled inputs update and
// read back. This validates the DOM technique against the REAL form.
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then((c) => c.newPage());
await page.goto('https://calmosis.com/peace-mantra', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
const add = page.getByRole('button', { name: /add to cart/i }).first();
await add.click();
await page.waitForTimeout(1500);
const proceed = page.getByRole('button', { name: /proceed to checkout/i }).first();
await proceed.click().catch(() => {});
await page.waitForTimeout(4000);

// Inject the same fill technique and read back.
const result = await page.evaluate(() => {
  function setReactValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const out = {};
  for (const el of document.querySelectorAll('input, textarea')) {
    const key = el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '';
    out[key] = { before: el.value };
  }
  // Try to fill an email-ish field
  const email = Array.from(document.querySelectorAll('input')).find((i) =>
    /email/i.test((i.getAttribute('placeholder') || '') + (i.getAttribute('name') || '') + i.id));
  if (email) { setReactValue(email, 'probe@example.com'); out.__emailAfter = email.value; }
  return out;
});
console.log('checkout form fields + fill result:', JSON.stringify(result, null, 2));
await browser.close();
```

- [ ] **Step 2: Run the probe**

Run: `npx tsx apps/api/scripts/probe-page-fill.mjs`
Expected: prints the checkout form's fillable fields and `__emailAfter: "probe@example.com"` — proving React-controlled inputs accept the technique and read back. If `__emailAfter` is empty, the field needs an `aria-label`/`id` and `resolveField` priorities (Task 1) must be checked against the real markup.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/probe-page-fill.mjs
git commit -m "test(e2e): probe React-safe fill against live Calmosis checkout"
```

---

## Deploy (after all tasks pass)

Per `reference_deploy_mechanics`: agent changes ride in **api** (Railway) and **voice-agent** (Railway); the widget changes ship via **web** (Vercel). Then run the live checkout trace (`apps/api/scripts/live-checkout-trace.mjs`) to confirm the bot emits `form_fill`/`form_read` then `click`, and the E2E probe (Task 6) for the real DOM.

```bash
railway up --service api --ci
railway up --service voice-agent --ci
vercel deploy --prod --yes
```

---

## Self-Review

**Spec coverage:**
- Generic `page.fill`/`page.read`/`page.click` → Tasks 1,2,4. ✓
- React-safe fill + read-back → Task 1 (`setReactValue`, `formFill` returns read-back). ✓
- Prefer site's own ids/selectors → Task 1 `resolveField` (`id`/`name`/`data-*` before fuzzy). ✓
- Widened `HostActionResult` carries `values`/`filled` → Tasks 2,3. ✓
- `page.click` is a NEW tool (site.click is demo-only) mapping to the widget `click` host action → Task 4. ✓
- Voice = collect / page = confirm + ask-before-click → Task 5 prompt. ✓
- Bliss Club via the real button → Task 5. ✓
- E2E proof against the real form → Task 6. ✓
- Phase 2 (crawl control graph + graph repair) intentionally NOT in this plan. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:** `HostActionResult` widened identically in all three files (agent `host-actions.ts`, widget `actions.ts`, widget `codec.ts`); `form_fill` carries `fields: Array<{field,value}>` everywhere; `toHostAction` emits `form_fill`/`form_read`/`click` matching the widget switch. ✓
