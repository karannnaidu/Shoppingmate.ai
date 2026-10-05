# Nav PRD Phase 1 — Snapshot refs + verify-after-action (plan)

PRD § Phase 1. Flag: `NAV_SNAPSHOT_V2` on api + voice-agent (`*` or comma list of merchant ids). Widget support ships unconditionally (inert until the server sends the new action/fields).

## Widget (`packages/widget/src/host`)
1. `snapshot.ts` — `buildSnapshot({maxChars=6000})`: open dialogs first, then `<main>` (fallback body); interactive (links, buttons, inputs, selects, ARIA widgets) + context (h1–h3, alerts/status) + up to 15 leaf price nodes. Name via exported `accessibleName` (+ wrapping `<label>`), states (checked/selected/expanded/disabled/value; passwords → `filled`, hidden inputs + aria-hidden/inert skipped). Priority-ranked truncation (dialog > main > far-below-fold > header/nav > footer), page order restored, `[eN]` refs assigned to kept nodes only via `data-sm-ref` + in-memory map. `elementForRef()`; `isOwnNode()` excludes `<shoppingmate-widget>` + `data-shoppingmate*` overlay nodes.
2. `verify.ts` — `verifyEffect(target, act)`: MutationObserver (ignores own nodes + ref attrs) + URL / cart-count / dialog-count / control-state diff; ≤1.5 s; returns `{verified, observed}`.
3. `actions.ts` — new `page_snapshot` action; `click` accepts `ref` (ref → element, fallback intent); both ref and intent clicks verify; same-origin link clicks report `navigating to …` up front (full reload would drop the result). **No automatic re-click on `verified:false`** (PRD 1.10 adjusted — a delayed add-to-cart would double); the model re-reads instead.
4. `form-control.ts` — `form_fill` fields accept `ref` (only honoured for INPUT/TEXTAREA/SELECT).
5. `transport/codec.ts` — validate `page_snapshot`, optional `ref`s, result `verified/observed`; **also adds the missing `cart_get`** decode case (pre-existing gap).

## Agent (`packages/agent/src`)
6. `tools.ts` — `navSnapshotEnabled()`, `PAGE_SNAPSHOT_TOOLS` (same names, ref params, verified semantics). Surface: Calmosis swaps legacy → snapshot page tools; Shopify + other site-graph merchants gain page.* only when flagged.
7. `runtime.ts` — route page.* as host actions when flagged; `toHostAction(..., {snapshot})` maps bare `page.read` → `page_snapshot`, carries refs.
8. `host-actions.ts` / `events.ts` — result `verified/observed` typed + preserved through decode (text WS + voice share `decodeWidgetMessage`).
9. `prompts/system.ts` — "SEEING + USING THE PAGE" block when flagged.

## Tests
Widget `snapshot.test.ts` (10), agent `nav-snapshot.test.ts` (8); existing click test updated for the new `verified` field.

## Rollout
Merge → deploy api + voice-agent + web (widget bundle) from main → set `NAV_SNAPSHOT_V2=SM-2SCCLZ` → real-browser smoke on calmosis.com (Playwright, text chat): page.read size + build time, a page.click with `verified:true`, bench latency vs Phase 0.
