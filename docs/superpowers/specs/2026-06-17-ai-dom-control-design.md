# AI-Driven DOM Control — Design Spec

**Date:** 2026-06-17
**Status:** Phase 1 detailed (approved direction); Phase 2 captured as follow-on.
**Author:** Claude + Karan (brainstorming session)

## Problem

The bot can drive the Calmosis storefront through brand-specific host-action hooks
(`__shoppingmateCartAdd__`, `__shoppingmateCheckoutFill__`, …), but the checkout
experience is brittle:

1. **Wrong values filled.** In voice mode two separate AI brains run: **Gemini Live**
   (the voice the visitor hears, which confirms values aloud) and a **side-channel
   model** (which actually fills the form). They never share the bot side of the
   conversation, so the filler re-parses messy spoken corrections independently and
   grabbed *first-mentioned* values (e.g. "Phones Paradise" instead of the corrected
   "Ferns Paradise", wrong phone/pincode). **The brain that confirms is not the brain
   that acts.**
2. **No read-back from reality.** The bot confirms from its own guess, not from what
   was actually filled, so the visitor can't catch the error.
3. **Field-by-field & invisible.** Details go into an invisible `pendingShoppingmateCheckout`
   object, not the real visible form, so the visitor can't see/correct them.
4. **Brittle replication.** Each brand action is hardcoded (e.g. the bliss-club catalog
   entry hardcodes `variant '400'`/`price 299` while the website derives them from the
   live backend product — see Bliss Club note below).

## Goal

One AI reliably controls the **real** website as text: it reads a page's fields/buttons,
fills the whole form from the conversation (reflecting the visitor's *latest* corrections),
reads back the **actual** values, and the visitor confirms on the real page — so what is
shown equals what is submitted. **No screenshots** (too slow). Generic across brands.

## Non-Goals (Phase 1)

- Cross-origin / iframe control (same-origin only, like the existing `navigate`).
- Re-architecting voice into single-brain native function-calling (we use "voice = collect,
  page = confirm" instead, which sidesteps the divergence without a voice rewrite).
- The crawl-built control graph + projection control-map (that is **Phase 2**).

## Chosen Approach

**Generic DOM control** with a **crawl graph + live fallback** source for control knowledge.
Phase 1 builds the runtime + the live fallback path (which is also the core robustness fix);
Phase 2 adds the crawl graph for speed/scale.

**Voice handling:** voice **collects** info conversationally; the bot fills the **visible**
real form and the visitor **confirms on the page** (the page, not the side-channel's speech,
is the source of truth).

---

## Phase 1 — Robust live form-fill + read-back (build first)

### New capability: generic, brand-agnostic page control in the widget

The widget runs inside the host page, so it can read and manipulate any **same-origin**
element directly — no per-brand `__shoppingmate*__` hook required. This is the key shift:
the bot controls the *real DOM*, it does not replicate the brand's logic.

### New agent tools

1. **`page.fill({ fields })`** — `fields: Array<{ field: string; value: string }>` where
   `field` is a human label/intent (e.g. "Email", "Pincode", "Full name"). Fills many
   fields in one call. Returns the **read-back**: the values actually present in those
   fields after filling.
2. **`page.read({ fields? })`** — returns current values of the named fields (or all
   detected form fields if omitted). Used to verify state / read the order back.
3. **`page.click({ intent })`** — **new tool** to press a page control (e.g. the page's own
   "Continue to Payment" / "Join Bliss Club" button). NOTE: the existing heuristic `site.click`
   is **demo-only** (gated to `SHOPPINGMATE_DEMO_MERCHANT_ID` because selector resolution wasn't
   built for arbitrary host sites). Calmosis currently gets only `SITE_NAV_TOOLS` (navigate).
   Phase 1's `resolveField`/`resolveIntent` work is exactly what makes click safe on real sites,
   so `page.click` maps to the **existing widget `click` host action** (already implemented via
   `resolveIntent` in `actions.ts`) — only the *tool* + `toHostAction` mapping are new.

`page.fill`/`page.read`/`page.click` are added to the site-graph tool surface (the
`isCalmosisStitch` branch, and available to any `siteGraphEnabled` merchant). The legacy
`checkout.fill`/`checkout.place`/`checkout.state` tools remain for now (no removal in Phase 1)
but the Calmosis checkout prompt switches to the navigate → fill → read-back → confirm-on-page
flow.

### Host-action wire format

Add to the `HostAction` union (agent `host-actions.ts` + widget `codec.ts`/`actions.ts`):

```ts
| { type: 'form_fill'; fields: Array<{ field: string; value: string }> }
| { type: 'form_read'; fields?: string[] }
```

Widen the success result to carry data (backward-compatible — existing `{ok:true}` callers
unaffected):

```ts
type HostActionResult =
  | { ok: true; values?: Record<string, string>; filled?: Array<{ field: string; ok: boolean; value: string }> }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };
```

The runtime already surfaces the whole `HostActionResult` to the model as the tool result
value (`envelope = { ok: true, value: result }`), so `values`/`filled` reach the model as the
read-back with no extra plumbing.

### Field resolution (widget)

Extend the ax-tree resolver with `resolveField(intent): HTMLElement | null` that targets
**form controls** (`input`, `textarea`, `select`).

**Prefer the website's own stable identifiers.** Match in priority order:
**exact `id`/`name`/`data-*` attribute (the same ids the site's own code uses)** →
`<label for>` text → `aria-label`/`aria-labelledby` → `placeholder` → nearest preceding label
text. Fuzzy text matching is the last resort, not the first. The same applies to `page.click`
targets (buttons): prefer the element's real `id`/stable selector over its label text. In
Phase 2 the crawl supplies these exact selectors (`selectorHint`) so runtime uses the *same
ids the website uses* with no guessing; Phase 1's live resolution is the fallback for elements
not yet in the graph.

### React-safe value setting (widget)

Controlled React inputs ignore a plain `el.value = x`. Set via the native prototype setter and
dispatch the events React listens for:

```ts
function setReactValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Checkboxes/radios: set `checked` + `click()`. After setting, **re-read `el.value`** for the
read-back so the returned value reflects any input masking/normalisation the page applied.

### Flow: voice = collect, page = confirm (Calmosis checkout)

1. Bot collects details conversationally (latest corrections win — it fills from the
   accumulated conversation, not an early snapshot).
2. `site.navigate({ path: "/checkout" })`.
3. `page.fill({ fields: [{field:"Full name",value:…}, {field:"Phone",value:…}, …] })`.
4. Bot reads the **returned read-back values** back to the visitor ("I've put X, Y, Z on the
   checkout page — does that look right?") — confirming from reality, not its guess.
5. Bot tells the visitor the details are on the checkout page and **offers the choice** (never
   auto-clicks): *"You're all set to continue on checkout — shall I click 'Continue to Payment'
   for you, or would you like to tap it yourself?"* Only on an explicit yes does it call
   `page.click({ intent: "Continue to Payment" })` (the page's own button → the storefront's own
   order logic runs). Either way the visitor sees the real values first.

### Prompt changes (`packages/agent/src/prompts/system.ts`)

- Replace the checkout closing flow to use navigate → `page.fill` → read-back from the returned
  values → confirm → **offer to click** "Continue to Payment".
- Instruct: always fill from the visitor's **most recent** correction; after filling, read back
  the **returned** values (never the bot's own memory) and ask the visitor to confirm.
- After confirmation, the bot **asks before clicking** the final button: *"shall I click
  'Continue to Payment' for you, or would you like to tap it yourself?"* — it only calls
  `page.click` on an explicit yes; it never auto-submits.

### Bliss Club fix (design-aligned)

Bliss Club add currently fails because `__shoppingmateCartAdd__` hardcodes the membership's
`variant`/`price`/`flavour`, while the website adds it from the live backend product. Phase 1
fix: the bot **clicks the website's own "Join Bliss Club" / membership add button** via
`page.click` when on a page that has it, so the brand's correct logic runs — instead of
replicating it. (Interim fallback if the button isn't present: keep the hardcoded add but
correct the attributes to match the backend product.)

### Error handling

- Field not found → `{ok:false, reason:'not_found'}`; bot tells the visitor it couldn't fill
  that field and offers to let them type it on the page (never claims success).
- Partial fill → `filled[]` marks which fields succeeded; the bot re-asks only the failed ones.
- `page.fill` only ever targets same-origin elements on the current page; never reads values
  back to any third party (read-back goes only to the model driving this session).

### Testing

- **Widget unit (happy-dom):** `setReactValue` dispatches `input`+`change` and updates value;
  `resolveField` matches by label / placeholder / name; `form_fill` returns read-back values;
  `form_read` returns current values; codec validates `form_fill`/`form_read` + decodes the
  widened result.
- **Agent unit:** `page.fill`/`page.read` present on the Calmosis surface; `toHostAction`
  maps them to `form_fill`/`form_read`; runtime dispatches them as host actions.
- **E2E (playwright probe against a deployed build):** navigate to `/checkout`, `form_fill`
  the address form, assert the React-controlled fields actually hold the values and the
  read-back matches; click "Continue to Payment" reaches the payment page.

### Risks / dependencies

- **Field labelling:** live resolution needs the form's fields to be resolvable by
  label/placeholder/name. Verify the Calmosis `AddressForm` fields during implementation; add
  `aria-label`s if any field is ambiguous. (Phase 2's crawl selectors remove this dependency.)
- **Selector/label drift** between deploys → handled by live resolution + (Phase 2) re-crawl.

---

## Phase 2 — Brand control graph (follow-on; not built in Phase 1)

The audit (2026-06-17) of Calmosis `SM-2SCCLZ` showed the existing "brand knowledge graph"
half-works and must be **repaired** as well as **extended**:

- ✅ Crawl healthy (93 pages), 320 FAQ entries, 36 nav/CTA `page_intents` (100% have selectors),
  projection used for navigation.
- ❌ **0 `site_nav_edges`** — flat page list, not a connected tree.
- ❌ **89/93 pages typed `other`** — page roles (home/PLP/PDP/FAQ/policy) mostly unknown.
- ❌ **0 `policy_documents`** despite 4 legal pages crawled.
- ❌ **No form/field/button control data** — only nav links + a few buttons.

**Phase 2 scope:**
- **(a) Repair:** emit nav edges (the real tree), fix page typing, extract policy documents.
- **(b) Control extractor:** during crawl, per page extract form fields
  (`{label, name, type, selector, required}`) and buttons/CTAs (`{label, selector, role}`)
  into a new `page_controls` table hanging off `site_pages`.
- **(c) Projection control-map:** fold the per-page control list into the projection the model
  receives, so on a given page the bot already knows its fields/buttons (no live round-trip).
- Runtime then prefers graph `selectorHint` for `resolveField`/`page.click`, falling back to the
  Phase 1 live resolution.

Each phase gets its own implementation plan.

## Other known bugs to fold in (tracked separately)

- **Bliss Club add** (above) — fix in Phase 1 via `page.click` the real membership button.
- **Voice navigation divergence** — "said taking you to checkout but still on shop page": the
  side-channel must reliably emit `site.navigate` on checkout intent; revisit after Phase 1.
