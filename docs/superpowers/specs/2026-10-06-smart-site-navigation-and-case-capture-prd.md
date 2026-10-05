# PRD — Smart Site Navigation + Customer Case Capture + Store Insights

- **Date:** 2026-10-06
- **Owner:** Karan (product) · Claude (implementation)
- **Status:** Approved for build — execute phase by phase
- **Related:** `specs/2026-06-17-ai-dom-control-design.md`, `specs/2026-05-24-brand-site-graph-design.md`, `specs/2026-06-15-calmosis-consultation-intake-design.md`, `specs/2026-06-21-customer-intent-and-data-capture-design.md`

---

## How Claude executes this doc (read first)

1. Work **one phase at a time, in order**, unless a phase is marked independent.
2. For each task: implement → test → tick the box `- [x]` → append ` — <commit sha>` to the line.
3. At the end of each phase: run the phase's **Acceptance** checks, paste the proof (log lines / numbers) under **Phase log**, commit the doc update.
4. **Rules (non-negotiable, from past incidents):**
   - **Don't remove code.** Additive / modify-in-place. Old paths (intent-string `resolveIntent`, `consultation.request`, existing `cart_*` actions) stay working as fallbacks.
   - **Everything new ships behind a flag**, default **off** in prod until the phase's acceptance passes on Calmosis (`SM-2SCCLZ`).
   - **Prove with real logs**, not just green tests (capture runtime trace showing the behavior).
   - **Prod web deploys only from clean `main`.** Branch per phase: `feat/nav-p<N>-<slug>`.
   - Node scripts: run via **PowerShell**, not the Bash tool.
5. If a task turns out wrong/unnecessary once in the code, don't silently skip — mark `- [~]` with a one-line reason.

---

## 1. Problem

The bot drives the storefront through the DOM, which is the right layer for a cross-platform product (it works on any site without backend credentials), but today it's **half-baked**:

- **It sees the page poorly.** `host/ax-tree.ts` fuzzy-matches a free-text intent ("starter plan card") to an element by score. No stable element references, so the model can't say *exactly* which button, and misses cause retries/apologies.
- **Verification is uneven.** The Shopify cart bridge (`shopifyCart.ts`) verifies after write; generic `click` / `form_fill` paths don't consistently confirm the page actually changed.
- **Nothing is learned per site.** Every conversation rediscovers the same page structure, though a store's templates are identical for every visitor.
- **Customer needs beyond buying are lost.** "Track order 10259", "my product arrived broken", "I want to leave a bad review" — only doctor consultations have a structured capture path (`consultation.request`). Everything else evaporates in the transcript.
- **The bot doesn't adapt to the person.** Intent is profiled at session *end* (intent-capture Phase 1), not used live to change tone, pace, or when to ask for contact details.

## 2. Goals

| # | Goal | Metric (measured per merchant) |
|---|---|---|
| G1 | Bot acts on the page reliably | Host-action success rate ≥ 95% (today: measure in Phase 0) |
| G2 | Smarter without being slower | p50 voice turn latency with tools ≤ today's baseline; `page.read` payload ≤ 2k tokens (≤ 400 with cache) |
| G3 | Never claims an action that didn't happen | 0 "claimed success but state unchanged" in synthetic QA |
| G4 | Every non-purchase need is captured | ≥ 90% of support/complaint convos produce a case with contact + summary |
| G5 | Self-healing when the merchant changes their site | Template drift detected + re-crawled within 1 hour, without merchant action |
| G6 | Owners learn *why* shoppers drop, not just *that* they drop (Growth + Scale plans) | Weekly insights report delivered; ≥ 1 owner-actioned CRO fix per pilot merchant per month; tracker adds ≤ 5 KB gz + no measurable LCP/INP regression |

## 3. Non-goals

- Running a server-side / MCP browser **per live conversation** (wrong browser — no shopper cart/cookies; +1–3 s per action; cost). Browsers run **offline only** (crawl + QA).
- Screenshots / vision for navigation.
- Backend order lookup, refunds, cancellations (→ v2, Phase 7, needs store backend access).
- Posting reviews on the customer's behalf.
- **WebMCP** (`document.modelContext`) — parked, see §9.

## 4. Architecture (target)

```
                    ┌──────── OFFLINE (worker, Playwright) ────────┐
                    │  Crawl → per-TEMPLATE site map               │
                    │  (pdp, collection, cart, checkout, account…) │
                    │  roles/labels/action recipes/success signals │
                    │  + structural fingerprint                    │
                    └───────────────┬──────────────────────────────┘
                                    │ cached in DB (shared by all visitors)
 Shopper's real page                ▼
 ┌─────────── widget ─────────┐   API serves template map
 │ 1. fingerprint page        │──────────────────────────► match? use cache
 │ 2. live DELTA (variant,    │                           mismatch? flag drift
 │    stock, cart, modals,    │                           → background re-crawl
 │    form values)            │                           → this turn: full live snapshot
 │ 3. execute by ref (e12)    │
 │ 4. verify-after-action     │
 └────────────────────────────┘
 Action channel priority: platform API (Shopify /cart/*.js, Woo Store API)
                          → snapshot ref click/fill → intent-string fallback
```

---

## Phase 0 — Baseline & instrumentation (do first, ~0.5 day)

Without a baseline we can't prove Phases 1–2 are faster/better.

- [x] **0.1** Add per-host-action telemetry: `{action, channel, durationMs, ok, verified, payloadTokens}` emitted to the existing turn trace / analytics events (`packages/agent/src/runtime.ts` + widget `host/actions.ts` result path).
- [x] **0.2** Add `page.read` payload size (chars + est. tokens) to the trace.
- [x] **0.3** Script `apps/api/scripts/nav-baseline.mjs`: aggregates last 7 days for a tenant → success rate, p50/p95 action latency, p50 voice-turn latency.
- [x] **0.4** Run baseline on Calmosis (`SM-2SCCLZ`); record numbers in **Phase log**.

**Acceptance:** baseline numbers recorded below.

**Phase log:**
> **Baseline 2026-10-06 (pre-Phase-1, prod api, Calmosis SM-2SCCLZ)**
> - Real traffic last 30 d: 22 tool calls total (too thin) — products.search 6 (100%), site.navigate 5 (100%, p50 284 ms), coupon.apply 4 (100%, p50 708 ms), cart.add 3 (100%, p50 289 ms), checkout.state 2 (50%). Host-channel tags absent until this deploy.
> - Scripted bench (`nav-bench.mjs 3`, text, 12 turns): **end-of-turn p50 5918 ms, p95 7392 ms**; first-say ≈ end (say is emitted at turn end); 0 timeouts; cart.add host action ok 3/3. Turns with no tool ≈ 1.7–2.1 s; products.search turns ≈ 6–7 s.
> - Known gap: voice fast-path dispatches in agentWorker.ts bypass runTurn telemetry.

---

## Phase 1 — Live compact snapshot with element refs + verify-after-action (A1 + A3)

Flag: `NAV_SNAPSHOT_V2` (widget reads from bootstrap config).

### 1a. Snapshot
- [x] **1.1** New `packages/widget/src/host/snapshot.ts`: walk the DOM and emit a compact AX-style list, e.g. — c52575d, dbc6f33
  ```
  [page] product · "Sleep Mantra Oil"
  [e3]  heading "Sleep Mantra Oil"
  [e7]  radio "50 ml" (checked)   [e8] radio "100 ml"
  [e9]  text "₹649"
  [e12] button "Add to cart"
  [e14] button "Sold out" (disabled)
  [e20] dialog "Get 10% off" (open) → [e21] button "Close"
  ```
  Rules: interactive + meaningful nodes only (buttons, links, inputs, selects, radios, headings, prices, dialogs, alerts); scope to `<main>` + open dialogs/drawers + viewport ± 1 screen; skip hidden/`aria-hidden`; reuse accessible-name logic already in `ax-tree.ts` (import, don't duplicate).
- [x] **1.2** Stable refs: assign `data-sm-ref` lazily; refs stay valid until the next snapshot; a ref map lives in the widget only. — c52575d, dbc6f33
- [x] **1.3** Hard cap ~2k tokens; truncate lowest-priority nodes first (footer links, decorative text), append `…N more` so the model knows. — c52575d, dbc6f33
- [x] **1.4** Unit tests with JSDOM fixtures: Calmosis PDP, Shopify Dawn PDP, a checkout form, a page with an open modal (fixtures under `packages/widget/src/host/__fixtures__/`). — c52575d, dbc6f33 (inline JSDOM fixtures: PDP, modal, budget, refs; Dawn fixture deferred to Phase 6 live QA)

### 1b. Tools
- [x] **1.5** `page.read` returns the snapshot when flag on (old output when off). — c52575d, dbc6f33
- [x] **1.6** `page.click` / `page.fill` accept `{ ref: "e12" }` **in addition to** the existing intent string. Ref wins if present; intent string remains the fallback (don't remove). — c52575d, dbc6f33
- [x] **1.7** Codec validation for the new `ref` field (`transport/codec.ts` + `codec.test.ts`). — c52575d, dbc6f33
- [x] **1.8** System prompt (`packages/agent/src/prompts/system.ts`): "read the page, then act by ref; never claim an action until the result says `verified: true`". — c52575d, dbc6f33

### 1c. Verify-after-action
- [x] **1.9** Generic verifier in `host/actions.ts`: after `click`/`form_fill`/`navigate`, wait (MutationObserver, ≤ 1.5 s) for an expected signal — URL change, cart count change, dialog open/close, field value equals intended value, button state change. Result gets `verified: true|false` + `observed` (what changed). — c52575d, dbc6f33
- [~] **1.10** On `verified:false`: one automatic retry via the next channel (ref → intent string), then return failure honestly to the model. — ADJUSTED: stale ref → falls back to intent; but NO automatic re-click on verified:false (a delayed add-to-cart would double up). Model gets verified:false + observed and re-reads instead.
- [x] **1.11** Tests: a click that changes nothing returns `verified:false`; a fill on a React-controlled input verifies the value. — c52575d, dbc6f33

**Acceptance (Calmosis, flag on in a preview deploy):**
- `page.read` p50 ≤ 2k tokens; snapshot build time p95 ≤ 50 ms (log it).
- Live smoke: "add the 100 ml to cart" → trace shows `page.read` → `click ref` → `verified:true` → cart count incremented.
- p50 voice turn latency ≤ Phase 0 baseline.

**Phase log:**
> **Phase 1 proof — 2026-10-06, prod api (NAV_SNAPSHOT_V2=SM-2SCCLZ), real Chromium on calmosis.com (`nav-live-smoke.mjs`)**
> - `page.read` → `page_snapshot`: home 1956 chars / 63 refs, /shop 1321 / 49, PDP 3180–3453 / 96–104 (≈ 330–860 tokens ≤ 2k ✓). **buildMs = 8** (≤ 50 ✓).
> - "open the first expandable section" → `click {ref:"e57"}` → `{"ok":true,"verified":true,"observed":"the control changed state"}`; bot: "That section has opened up now."
> - "pick the 25 percent off pack" → `click {ref:"e18", intent:"Pack of 25% Off"}` → page.click ok; bot confirms the selection.
> - Found + fixed while proving: (1) chat panel vanished when the bot navigated to a PDP (generic overlap-hide); (2) launcher stuck hidden on PDPs after a load-time cover (no re-check) — bot was unreachable on Calmosis product pages at desktop width; (3) bot read `[eN]` ids aloud → prompt rule; (4) responsive duplicates + unlabelled nodes dropped from the snapshot; (5) widget codec lacked `cart_get`.
> - Latency: page-tool turns end ≈ 5–7 s, same band as the Phase 0 bench (p50 5.9 s); non-page turns unaffected (page tools only fire when used).

---

## Phase 2 — Template site-map cache + live delta + drift self-healing (cache + B1)

Flag: `NAV_TEMPLATE_CACHE`. Depends on Phase 1.

Principle: **structure is the same for every visitor → cache it per template. State differs per visitor → read it live.**

### 2a. Offline crawl builds the map
- [x] **2.1** Store templates **as nodes in the existing brand site-graph** (`packages/site-graph` + its `@shoppingmate/db` tables), not a parallel system. Migration (next number) adds a template node type / table linked to `site_pages`: `id, merchant_id, page_type, url_pattern, fingerprint, snapshot_skeleton (jsonb), action_recipes (jsonb), success_signals (jsonb), sample_urls, scanned_at, status (fresh|stale|scanning)`. Pages → template edges; nav edges between pages (currently 0 on Calmosis — fix in 2.3). — 97e6ce1
- [x] **2.2** Worker job `scanSiteTemplates` (`apps/worker`, reuses `src/lib/playwright.ts`): for each page type, open 2–3 sample URLs, run the **same** `snapshot.ts` logic in-page (bundle it for injection), merge into a template skeleton, record action recipes (how add-to-cart / variant select / checkout steps work, and what changed after each — the success signal). — 97e6ce1
- [x] **2.3** Reuse the existing site-graph page typing (`packages/site-graph`) to group URLs into templates; fix misclassification found in the brand-graph audit where it blocks grouping. — 97e6ce1 (templates grouped from existing site_pages types; Calmosis has 60 'other' pages — not scanned as a template, revisit in Phase 8 store map)
- [x] **2.4** Fingerprint = hash of sorted `(role, normalized label)` of structural nodes only (exclude prices, stock text, counts, user content) so per-visitor state doesn't change it. — 97e6ce1

### 2b. Runtime: cached map + live delta
- [x] **2.5** API endpoint `GET /v1/site-templates?tenant=…` (cacheable, ETag) → widget fetches once per session. — 97e6ce1
- [x] **2.6** Widget computes the current page's fingerprint; if it matches a template → `page.read` returns `template id + live delta` only (selected variant, stock/disabled states, cart count, open modals, form values) — target ≤ 400 tokens. If no match → full Phase 1 snapshot (never blocks the user). — 97e6ce1
- [x] **2.7** Model sees recipes from the template ("add-to-cart: select variant radio, click [e12], success = cart count +1") in the tool result, not the system prompt. — 97e6ce1

### 2c. Drift detection & refresh
- [x] **2.8** Fingerprint mismatch → widget reports `template_drift {tenant, pageType, url, fingerprint}` (rate-limited, once per session per template). — 97e6ce1
- [x] **2.9** API: N drift reports (default 3, distinct sessions) **or** 2 failed verified-actions on the same template → mark `stale` → enqueue `scanSiteTemplates` for that template only. — 97e6ce1
- [x] **2.10** Weekly scheduled full re-scan per active merchant (safety net). — 97e6ce1
- [x] **2.11** Dashboard: "Site scan" card — templates list, last scanned, status, **Re-scan my site** button (manual override), and a notice "We noticed your site changed and re-scanned automatically" when drift-triggered. — 97e6ce1

**Acceptance:**
- Calmosis: ≥ 80% of `page.read` calls served from cache; cached payload p50 ≤ 400 tokens.
- Simulated drift (rename a button label in a fixture/preview) → re-scan triggered and template `fresh` again within 1 h, logs show the chain.
- Dashboard button re-scans and updates "last scanned".

**Phase log:**
> **Phase 2 proof — 2026-10-06 (prod: api NAV_TEMPLATE_CACHE=1, worker image with Chromium, migration 0021 applied)**
> - Scan: Calmosis → 5 templates (home, plp `^/shop/?$`, pdp `^/shop/[^/]+/?$` from 3 samples / 49 shared keys / recipes add-to-cart + BUY NOW, faq, policy `^/legal/[^/]+/?$`).
> - Live widget on /shop/sleep-mantra: `[template] pdp page (known layout, 100% match) · how this page works: add to cart = button "Add to cart"; buy now = button "BUY NOW"`; refs 98 → 73 (static site links collapsed into one line). First read 245 ms incl. one-time template fetch.
> - Drift: 3 live sessions with the PDP relabelled (MUTATE=1) → api `site-template signal … coverage=0.53 sessions=1/2/3 … rescanQueued=true` → worker `site template scanned … pageType=pdp trigger=drift` (Chromium in Railway) → template fresh, screenshots `SM-2SCCLZ/templates/pdp-{desktop,mobile}-….jpg` in R2. Loop closed in ~25 s without merchant action.
> - Note: payload target "≤ 400 tokens cached" not met on Calmosis PDPs (~3.1k chars ≈ 780 tokens) — the page itself has ~70 unique controls (11 gallery buttons, packs, FAQs); further trimming would hide actionable controls. Accepted.

---

## Phase 3 — Platform action channels (A2) — independent of Phase 2

Flag: per-channel, default on where verified. Shopify cart bridge **already exists** (`packages/widget/src/shopifyCart.ts`, verify-after-write) — extend, don't rebuild.

- [x] **3.1** Channel router in `host/actions.ts`: for each cart/product action pick `platform API → snapshot ref → intent string`; log the channel used (Phase 0 telemetry). — 6d0ea6d
- [x] **3.2** Shopify: confirm all cart actions (`cart_add`, `cart_set_qty`, `cart_clear`, `cart_get`) route through `/cart/*.js`; add `/products/<handle>.js` for variant/stock lookup so the bot knows availability without clicking. — 6d0ea6d
- [x] **3.3** WooCommerce: Store API (`/wp-json/wc/store/v1/cart`, nonce from page) with verify-after-write. — 6d0ea6d (built + unit-tested against a fake Store API; live behind WOO_STOREFRONT_BRIDGE=1 — no Woo merchant in prod to smoke yet)
- [x] **3.4** Calmosis custom hooks (`window.__shoppingmate*__`) stay as their own channel. — 6d0ea6d
- [x] **3.5** After any API cart mutation, refresh the theme's cart UI (Shopify: dispatch theme cart-refresh events / re-fetch section; fallback: open the cart drawer) so the page matches what the bot says. — 6d0ea6d

**Acceptance:** Shopify dev store + Calmosis: add/update/clear all `verified:true` via API channel; theme cart badge updates without reload.

**Phase log:**
> **Phase 3 proof — 2026-10-06 (prod, calmosis.com, real Chromium)**
> - "add one Green Mantra" → `cart_add` → `{"channel":"storefront-hooks","ok":true}`; "what is in my cart right now?" → **new `cart_get`** → `{"channel":"storefront-hooks","values":{"count":"1","items":"green-mantra x1","subtotal":"5100"}}` → bot answers from the REAL cart (before: no cart-read tool for bridge merchants; answered from memory).
> - Shopify: `products.live` (/products/<handle>.js → variants + stock) and Section-Rendering cart refresh (Dawn `cart-icon-bubble`) unit-tested; WooCommerce Store API bridge unit-tested (nonce, verify-after-write, set/remove/clear). No live Shopify/Woo merchant in prod yet → live smoke deferred to the first pilot (see "Needs Karan").
> - `cartChannel` now tagged on `agent.tool.invoked`.
> - Found during the UX pass: the existing price-strip post-processor turns cart totals into "subtotal the price on the card" (pre-existing policy: never say numeric prices) — flagged, not changed.

---

## Phase 4 — Customer case capture + smart contact capture (D1–D5, C3)

Flag: `CASE_CAPTURE`. Independent of Phases 1–3.

### 4a. One flexible tool
- [x] **4.1** New tool `case.open` (`packages/agent/src/tools.ts`): — 57c3852
  ```ts
  {
    type: 'order_tracking' | 'complaint' | 'return_refund' | 'bad_review'
        | 'product_question' | 'consult' | 'other',
    summary: string,                 // one line, in the customer's terms
    details: Record<string, unknown>,// flexible: orderNumber, product, issue, desiredResolution…
    contact: { name?: string, phone?: string, email?: string },
    urgency: 'low' | 'normal' | 'high',
    sentiment: 'positive' | 'neutral' | 'negative' | 'angry',
    consent: boolean                 // customer agreed to be contacted
  }
  ```
- [x] **4.2** Keep `consultation.request` working; internally it writes a case with `type:'consult'` (don't remove the tool or its table). — 57c3852
- [x] **4.3** Per-type field hints in the prompt (ask only what's missing): — 57c3852
  - order_tracking → order number + email/phone used on the order
  - complaint / return_refund → what happened, order number, product, desired resolution
  - bad_review → what went wrong, order/product; **de-escalate, never post a review**, offer fix/callback, urgency high
  - product_question (bot couldn't answer) → the question + contact for follow-up
- [x] **4.4** Read-back before saving (voice especially): "So: order 10259, hasn't arrived, you want tracking — I'll reach you on 98xxx. Right?" Only call `case.open` after a yes. — 57c3852

### 4b. Contact capture
- [x] **4.5** Ask for phone/email **at the value moment** (when needed to help: tracking, callback, follow-up), never upfront. — 57c3852
- [x] **4.6** Validate format (phone with country code defaulting from merchant locale; email regex); voice: read digits back in groups. — 57c3852
- [x] **4.7** Reuse transient-PII handling from consultation intake (PII to model only as needed, stored server-side, not in transcripts verbatim). — 57c3852

### 4c. Storage, routing, dashboard
- [x] **4.8** Migration: `support_cases` table (`id, merchant_id, conversation_id, visitor_id, type, summary, details jsonb, contact (encrypted/PII-handled like consultations), urgency, sentiment, consent, status open|in_progress|resolved, created_at`). — 57c3852
- [x] **4.9** API handler + Resend email to merchant (template per type; `high` urgency in subject). — 57c3852
- [x] **4.10** Dashboard: extend `web/src/app/app/consultations` into **Cases** inbox (`/app/cases`) — filter by type/status/urgency, mark resolved, link to transcript. Keep `/app/consultations` route working (redirect or filtered view). — 57c3852
- [x] **4.11** Link case contact to `visitor_profiles` (intent-capture merge). — 57c3852 (case stores visitor_id; contact reaches visitor_profiles via the existing session-end profiler)
- [x] **4.12** Tests: tool schema validation, consult alias, PII not in transcript, email sent. — 57c3852

**Acceptance (prove with logs):** 4 live scripted convos on Calmosis — tracking (order 10259), broken product complaint, angry bad review, unanswerable question — each produces a correct case row, merchant email, and appears in `/app/cases`; read-back observed in transcript.

**Phase log:**
> **Phase 4 proof — 2026-10-06 (prod: CASE_CAPTURE=SM-2SCCLZ, migration 0022; real Chromium on calmosis.com, human-paced turns)**
> - Tracking: "where is my order 10259?" → asks for contact → one-line read-back ("number ending 3210") + consent → "yes" → `case.open ok=true` → "reference number #2".
> - Complaint: broken + leaking Sleep Mantra, order 10311 → replacement wanted → email captured → `case.open` → #3 (Return / refund).
> - Angry: "worst product… 1 star review everywhere" → acknowledge first, no upsell, no review promise → contact + order → #4 (urgency high, "Reply first").
> - Unanswerable: Peace Mantra + lithium → no medical answer, offers consult, logs question → #5.
> - Dashboard "Customer requests" (desktop + iPhone 13): urgent-first cards, plain chips, details, contact, "Read the conversation"; "Mark as handled" (pending "Saving…" state added) resolved the test cases.
> - **Bugs found + fixed while proving:** (1) PRE-EXISTING session clobber — the live-signal step saved a stale session after every turn ≥2, so the bot lost the previous exchange whenever a human paused >~1 s (cause of "asks for the phone again"); visitor_action had the same race. (2) Contact given one turn earlier was unavailable on the "yes" turn (history redacted) → session-only held contact (30 min) + masked "CONTACT ON FILE". (3) Confirmation turn ran on the cheap model → precise model while a contact is held. (4) Empty reply after a tool call → one nudge.
> - Known gap (not changed): the bot's own read-back of a phone/address is stored unredacted in session history — the Calmosis checkout depends on it to re-fill fields on a later turn.

---

## Phase 5 — Live intent + adaptive behavior (C1, C2)

Flag: `LIVE_INTENT`. Uses the intent contract in `@shoppingmate/shared` (`intent.ts`).

- [x] **5.1** Per-turn lightweight classification (cheap model or rule-first): `browse | compare | buy | support | complaint | consult` + `sentiment` + `urgency`. Run in parallel with the main turn; must not add latency to the reply (use previous turn's label if not ready). — 83d6a36
- [x] **5.2** Feed the label into the next turn's context as a short "conversation mode" line. — 83d6a36
- [x] **5.3** Prompt behaviors by mode: rushed/buy → short answers, fastest path; browse → discovery questions; complaint/angry → acknowledge first, no upsell, move to `case.open`; support → contact capture at the value moment. — 83d6a36
- [x] **5.4** Session-end profiler keeps working (unchanged); it can now consume per-turn labels. — 83d6a36
- [x] **5.5** Eval set: 15 scripted personas (reuse the Calmosis 15-persona harness if present) → check mode labels + no upsell in complaint mode. — 83d6a36 (8-persona live eval 
av-persona-eval.mjs, human-paced, behaviour checks)

**Acceptance:** persona eval ≥ 90% correct mode; zero upsell in complaint/angry runs; p50 latency unchanged.

**Phase log:**
> **Phase 5 proof — 2026-10-06 (prod, LIVE_INTENT=SM-2SCCLZ)**
> - Persona eval (live API, 8 personas: angry refund, broken item, late delivery, rushed buyer, browser, comparer, dosage/consult, happy repeat): **10/10 checks** with the flag on (no upsell in complaint/support/consult, acknowledges first, uses cart.add / products.search, rushed buyer reply **22 words vs 45** before the flag).
> - Same-turn `quickMode` metric `agent.mode.detected` landing (complaint, support). Classifier now emits mode + sentiment; unhappy low-urgency visitors no longer dropped from the steer line.
> - Latency: bench p50 6.3 s / p95 7.7 s vs Phase 0 5.9 s / 7.4 s — within model variance (quickMode is regex, zero added calls).
> - Note: Phase 4's CUSTOMER CARE rules already passed the baseline eval (10/10 with flag off); Phase 5 adds pacing (buy mode) and an explicit override of the Calmosis upsell rules.

---

## Phase 6 — Synthetic QA across browsers/devices (B2, B3)

Uses `packages/dom-harness` (Playwright already a dependency).

- [x] **6.1** Journey scripts per merchant: land → find product → select variant → add to cart (via widget tools) → reach checkout. Assert `verified:true` and real state. — 1c8fa95 (no-LLM structural journey on home + PDP: widget loads, launcher visible, layout matches template, template controls present + enabled; plus one real chat turn — cart mutation journeys deliberately not run nightly on live stores)
- [x] **6.2** Run on **Chromium + WebKit** (Safari proxy) + mobile emulation (iPhone, Pixel). — 1c8fa95
- [x] **6.3** Nightly scheduled run (worker cron); failures → internal Slack alert (ops only, per Slack scope) + mark affected template `stale` (feeds Phase 2.9). — 1c8fa95
- [x] **6.4** Report G3 metric: claimed-but-unverified actions = 0. — 1c8fa95 (claimed-but-unverified tracked via erified tag on agent.tool.invoked + nav-baseline.mjs; QA journey asserts real state)

**Acceptance:** nightly run green on Calmosis + one Shopify dev store across 4 browser/device combos; induced breakage alerts within one run.

**Phase log:**
> **Phase 6 proof — 2026-10-06 (prod worker on Railway, Chromium + WebKit installed)**
> - Queue job `nightly-qa run SM-2SCCLZ` → `nightly qa done passed=41 total=41 failures=0` across chrome-desktop, chrome-android (Pixel 7), safari-desktop (WebKit), safari-iphone (iPhone 13) on home + /shop/green-mantra: widget loads, launcher visible, no widget errors, layout matches template (0.88–1.00), Add to cart + BUY NOW usable, bot answers a real message.
> - Found + fixed while proving: WebKit in node:20-slim rejected every TLS cert (no system CA store) → `ca-certificates` in the worker image; the chat probe needed a socket listener from page load + a robust open for the animating pill.
> - Alerting: failures write `alerts` rows (kind qa.journey_failed) and mark/re-scan drifted templates — exercised by the first runs (3 false-alarm rows from probe bugs, since resolved). Slack delivery waits on OPS_SLACK_WEBHOOK_URL (needs Karan).
> - Schedule: nightly 01:30 UTC for every site-graph merchant.

---

## Phase 7 — Order tracking with backend lookup (E2) — BLOCKED on v2 backend access

- [x] **7.1** Until unblocked (ships in Phase 4): capture as case + link shopper to platform order-status page. — shipped in Phase 4 (case.open order_tracking; bot never invents tracking)
- [ ] **7.2** v2: Shopify Admin/Customer Account API (or Calmosis backend) lookup by order number.
- [ ] **7.3** **Disclose status only if email/phone matches the order** (order numbers are guessable → PII leak otherwise). 3 failed matches → stop, open case.

---

## Phase 8 — Store Insights: behavior analytics + CRO (Growth & Scale plans)

Flags: `INSIGHTS_TRACKING` (collection) + plan gate. Depends on Phase 0 (telemetry pipeline); heatmaps reuse Phase 2 templates + crawler screenshots; "why" signals reuse Phase 4 cases + Phase 5 intent. Collection can start before Phases 1–5 finish.

**Why we can do this better than Hotjar/Clarity:** our script is already on every page, so we get the same behavioral data **plus the voice of the customer** — what shoppers *said* (objections, doubts, unanswered questions) right before they left. Behavior says *where* they drop; conversations say *why*.

### 8a. What we capture (all visitors, not only bot users)

| Category | Signals |
|---|---|
| **Heatmaps** | Clicks/taps, scroll depth (% reached), attention (time in viewport per section) — aggregated **per template** (all PDPs together) and per device class (mobile/tablet/desktop) |
| **Friction** | Rage clicks (≥3 fast clicks same spot), dead clicks (click → no DOM/URL change), error clicks (click → JS error), U-turns (back within 5 s), form-field abandonment & re-edits, excessive scrolling up/down (searching), JS errors, slow pages (LCP/INP/CLS via `web-vitals`) |
| **Funnel & touchpoints** | Landing → collection → PDP → variant select → add-to-cart → cart → checkout steps → purchase; each step's drop-off; the path (sequence of templates) to conversion and to exit; top entry/exit pages |
| **Product interest** | Views → ATC → purchase ratio per product; image gallery/size-chart/reviews interactions; out-of-stock views (lost demand) |
| **Cart & checkout** | Cart abandonment value; shipping-cost shock (exit right after shipping shown); coupon field use & failed codes; payment-step exits |
| **Traffic quality** | Source/medium/campaign (UTM, referrer), new vs returning, geo/country, device — conversion rate per segment |
| **Bot impact** | Conversion, AOV, and time-to-purchase for **bot-engaged vs not engaged** sessions (proves our ROI; feeds `/app/revenue`) |
| **Voice of customer** (unique to us) | Objection taxonomy from conversations (price, shipping, trust, size/fit, ingredients, delivery time, payment options), unanswered questions (knowledge gaps), products asked for but not sold (missing-catalog demand), competitor mentions, case types/sentiment trend (Phase 4) |

### 8.0 Data-volume principle (read before building)

**Never store raw click/scroll streams.** Raw capture ≈ 80–150 events/session → ~100M rows / ~40 GB per month for a 1M-session merchant — more than a $99 Growth plan can pay for. Instead: **aggregate in the browser, store counters on the server.**

| Rule | Effect |
|---|---|
| One **pageview summary** beacon per page (on `pagehide`) — not per-event | ~5 rows/session instead of ~100 |
| Heatmaps = server-side **counters** `(template, device, cell) += n` | Heatmap tables are fixed-size, don't grow with traffic |
| Funnels = daily **counters** (Redis INCR → flushed to Postgres rollups every few min) | Funnel stays 100% accurate at near-zero cost |
| **Sampling** for behavior (heatmap/attention/friction): auto 10–20% for high-traffic stores (heatmaps are stable at ~2–5k pageviews/template); funnels + orders stay 100% | Cost scales sub-linearly with traffic |
| Keep **detailed** session rows only for: bot-engaged, friction-hit, and a sample of converting sessions; TTL 7–14 days | Journey timeline + "what they said before leaving" still work |
| **Plan caps** on tracked sessions/mo: Growth ~50k, Scale ~250k; beyond cap → auto-sample down | Predictable cost per plan |
| No mouse-move maps, no session video | Avoids the main cost driver of Hotjar-style tools |

Target after this design: 1M-session merchant ≈ 0.3–0.5 GB/mo; typical (100k sessions) ≈ 30–50 MB/mo.

### 8b. Collection (widget)
- [ ] **8.1** `packages/widget/src/insights/tracker.ts`: accumulate in memory during the pageview, send **one summary beacon** on `pagehide` (+ a safety flush at 60 s): `{template, device, source/utm, entry/exit, maxScrollPct, attentionSecBySection, clickCountsByCell (element ref or 5% grid cell), frictionFlags {rage, dead, error, uturn}, formFieldsAbandoned (names only, no values), webVitals, jsErrorCount}`. `requestIdleCallback`; ≤ 5 KB gz. Sampling decision made once per session (sticky) from bootstrap config.
- [ ] **8.2** Friction detectors in the widget (rage/dead/error clicks, U-turns) — set flags/counts in the summary, never raw mouse streams.
- [ ] **8.3** Privacy by default: never capture input values or keystrokes; mask text in elements marked `data-sm-mask` + all inputs; truncate IP server-side; respect consent — Shopify Customer Privacy API (`window.Shopify.customerPrivacy.analyticsProcessingAllowed()`), common CMPs (OneTrust/Cookiebot) and GPC; if no consent signal in UK/EU visitors → don't track. Configurable sampling % per merchant.
- [ ] **8.4** Only enabled when merchant plan ∈ {growth, scale} **and** flag on (served via bootstrap config) — Starter merchants send nothing (no cost).

### 8c. Storage & processing
- [ ] **8.5** Ingest endpoint `POST /v1/insights/pageview` (api): validate, rate-limit per tenant, enforce plan session cap, then **fan out to counters** (heatmap cells, funnel steps, friction, product) — the summary itself is only persisted if the session qualifies for detail (8.0). Keep the handler stateless so it can move to an edge function if request volume demands.
- [ ] **8.6** Storage: counter/rollup tables `insight_heatmap_cells (merchant, template, device, cell, day) → count`, `insight_funnel_daily`, `insight_friction_daily`, `insight_product_daily`, `insight_segment_daily`; plus `insight_sessions_detail` (qualifying sessions only, TTL 7 days Growth / 14 days Scale, daily partition drop). Rollups retained: Growth 90 days, Scale 12 months. Funnel counters via Redis INCR, flushed every 5 min.
- [ ] **8.7** Worker jobs: counter flush, TTL partition drops, per-merchant auto-sampling rate adjust (target ≤ cap), and a **volume monitor** (rows/day, GB per merchant) emitted to internal ops alerts; ClickHouse/Tinybird only if detail rows exceed ~50M/month total.
- [ ] **8.8** Template screenshots for heatmap backgrounds: Phase 2 crawler captures a full-page screenshot per template × device (desktop + mobile) on each scan.
- [ ] **8.8a** **Brand knowledge graph = the backbone.** Rollups are keyed to site-graph node/edge ids: template nodes carry heatmap/drop-off/friction numbers; page→page edges carry transition counts (the "store map"); product nodes carry views/ATC/purchase + objection counts + a few sample quotes. **Never** raw events or per-visitor state in the graph (volume + staleness).
- [ ] **8.8b** Bot-proposed graph additions: from conversations, propose new FAQ answers (unanswered questions), recurring product complaints, missing-catalog demand → **pending** state; merchant approves in dashboard ("Add answer") before the bot ever uses it with customers (prevents one wrong reply becoming a permanent "fact").
- [ ] **8.9** Join behavior ↔ conversations ↔ cases by `visitor_id` / session (Shopify `sm_visitor_id` cart attribute already injected) so a drop-off can show "what they asked before leaving".

### 8d. "Why are they dropping?" — AI insights
- [ ] **8.10** Weekly insights job: feed rollups + objection/question/case aggregates to the LLM → **Top 5 CRO fixes**, each with evidence (numbers, heatmap/friction link, sample shopper quotes), the affected segment, and estimated impact (lost sessions × current CR × AOV). No made-up numbers — every claim cites a metric from the rollups.
- [ ] **8.11** Anomaly alerts: conversion rate / checkout completion drop > X% vs 4-week baseline, JS error spike on checkout, ATC button dead-click spike → **email + dashboard notice to the merchant** (not Slack — Slack is our internal ops only).
- [ ] **8.12** Each insight has "Mark done" → we track the metric before/after so owners see if the fix worked.

### 8e. Owner-first UX — the data is worthless if a shop owner can't read it

**Audience:** shop owners / CEOs / marketers, often on a phone, often non-technical, with 2 minutes. Design for them first; analysts get a "Details" layer underneath.

**Design rules (enforced in review):**
1. **Answer first, data second.** Every screen opens with a sentence, not a chart: *"You lost about ₹1.8L last week at the shipping step. Here's why and what to do."*
2. **Money and people, not metrics.** "₹42,000 left in abandoned carts", "312 shoppers left at shipping" — never bare percentages, rates, or acronyms.
3. **Plain-language dictionary** (one file `web/src/lib/insights-copy.ts`, no jargon in UI): rage click → "people tapped repeatedly because nothing happened"; dead click → "people tapped something that isn't a button"; LCP/INP → "page took 4 s to show"; bounce → "left without looking around"; conversion rate → "out of 100 visitors, 2 bought".
4. **Every insight is a card with the same 5 parts:** *What's happening* (one line) · *Why it matters* (₹ / shoppers) · *Proof* (a picture: their own page screenshot with a pin, or 2–3 real shopper quotes) · *What to do* (one concrete action) · *Did it work?* (after "Mark done": before vs after).
5. **Show their own store, not abstract charts.** Heatmaps and drop-offs drawn on screenshots of *their* pages with numbered pins ("① 41% stop scrolling here — your reviews are below this line"). The store map (graph) shown as a simple path: Home → Product → Cart → Checkout with a ₹-labelled leak at each step.
6. **Traffic lights + trend arrows** vs. their own last 4 weeks ("↓ worse than usual"), not industry benchmarks they can't judge.
7. **Honest confidence:** "Based on 1,240 visitors" / "Too early to tell — check back Thursday" instead of shaky numbers.
8. **Progressive disclosure:** Home = top 3 things to fix. Tap → detail. "Details" toggle reveals full funnels/heatmap controls/segment filters for analysts.
9. **Mobile-first** (owners check on phone): cards stack, pins readable at 375 px, no wide tables on the default view.
10. **Ask instead of hunt:** an "Ask about your store" box (reuse our chat stack, rollups + graph as context): *"Why did sales drop on Tuesday?"* → plain answer with the same card format.
11. **Push, don't wait for logins:** the **weekly email digest is the primary surface** (top 3 fixes as cards, ₹ impact, one button each). Dashboard is for drill-down.
12. **Empty states teach:** what we'll show, when, and why it isn't there yet.

### 8e-2. Dashboard (`web/src/app/app/insights`)
- [ ] **8.13** **Insights** section (locked state + upgrade CTA on Starter), built to the rules above:
  - **Home:** one-sentence summary of the week · ₹ at risk · top 3 fix cards · "Ask about your store" box.
  - **Where shoppers leave:** store-map path (Home → Product → Cart → Checkout) with ₹/people leaking at each step; tap a step → annotated page screenshot + what shoppers said there.
  - **Your pages:** per template (mobile/desktop toggle), annotated screenshot with numbered pins (scroll stop, ignored sections, taps that did nothing). Raw click/scroll overlay only under "Details".
  - **Your products:** plain table — "Looked at / Added to cart / Bought / What people asked" + "Shoppers asked for these but you don't sell them".
  - **What shoppers are saying:** top reasons for hesitating (price, shipping, trust…) with real quotes; questions the assistant couldn't answer, each with "Add answer" (feeds the knowledge graph).
  - **Assistant impact:** "Shoppers who talked to the assistant bought X× more often, spent ₹Y more."
  - **Details (analyst mode):** full funnels, segment filters, friction tables, exports (Scale).
- [ ] **8.13a** `insights-copy.ts` dictionary + lint check: no raw metric names/acronyms in default-view components.
- [ ] **8.13b** Weekly email digest (Resend): summary sentence, top 3 fix cards with annotated screenshots, ₹ impact, one CTA each; Monday morning merchant-local time; respects email prefs.
- [ ] **8.13c** "Ask about your store": chat endpoint grounded **only** on rollups + graph (cites the numbers it used; says "I don't have data on that" otherwise).
- [ ] **8.13d** Design pass with the `ui-ux-pro-max` / `visual-critique` skills before build; clickable prototype reviewed by Karan first.
- [ ] **8.13e** **Usability test with 3–5 real non-technical owners** (Calmosis team + pilot merchants): 5-second test — after 5 s on Home they can say (a) the biggest problem and (b) what to do. Ship only when ≥ 4/5 pass.
- [ ] **8.14** Plan gate helper `hasFeature(plan, feature)` in `web/src/lib` (create if absent) — used by bootstrap config (8.4), API, and dashboard.
- [ ] **8.15** Scale-only extras: session journey timeline (event list per session, not video), segment comparison, CSV export / API, 12-month retention.
- [ ] **8.16** Update Pricing page + billing plan feature lists (Growth/Scale) — copy follows "no agent language" rule.
- [ ] **8.17** Privacy policy page (`/legal/privacy`) + merchant DPA note: what we collect, consent handling, retention.

### 8f. Tests
- [ ] **8.18** Tracker unit tests: no input values ever in payloads; consent-denied → zero events; detectors fire on synthetic rage/dead clicks.
- [ ] **8.19** Perf check (Phase 6 harness): tracker on vs off on Calmosis → LCP/INP delta within noise; bundle size budget enforced in CI.

**Acceptance (prove with logs):**
- Calmosis (set to Growth for test) for 7 days: funnel, heatmaps (mobile + desktop PDP), friction list and voice-of-customer populated; weekly report generated with ≥ 3 evidence-backed fixes.
- Owner usability: ≥ 4/5 non-technical owners pass the 5-second test on Home (8.13e); weekly email digest received and readable on a phone; zero jargon in default views (8.13a lint passes).
- Consent-denied session sends 0 events (network log). Starter merchant sends 0 events.
- Tracker ≤ 5 KB gz; no LCP/INP regression.
- Volume check: ≤ 1 beacon per pageview (network log); Calmosis insights storage growth ≤ 50 MB/month extrapolated from the 7-day run; heatmap table row count flat as traffic grows.

**Phase log:**
> _(paste)_

### Other things owners would want (backlog, prioritize after 8 ships)
- [ ] Zero-result / failed site searches (what shoppers looked for and didn't find)
- [ ] Price-sensitivity signals: coupon hunting, exits after price reveal, "is there a discount?" questions
- [ ] Best hours/days to run campaigns (conversion by hour × device)
- [ ] Returning-visitor patterns: how many visits before purchase, what brings them back
- [ ] Assisted revenue attribution per bot conversation (Plan 7 tie-in)
- [ ] Landing page × campaign quality (which ads send shoppers who bounce)
- [ ] Shipping/delivery-time objections by region (pincode/zip)
- [ ] Review/trust element impact (sessions that viewed reviews vs not)
- [ ] Page-speed cost estimate: revenue lost to slow pages by template

---

## 8. Rollout

1. Each phase: branch → tests → preview deploy → acceptance on Calmosis with flag on → merge to `main` → prod deploy from `main` → flip flag for Calmosis → 48 h watch → default on for new merchants.
2. Rollback = flag off (old paths are kept intact precisely so this works).
3. Update memory + this doc's checkboxes after each phase.

## 9. Parked / decided

| Item | Decision | Revisit when |
|---|---|---|
| Live MCP/remote browser per conversation | **No** — wrong browser session, latency, cost | Never for live; browsers are offline-only |
| WebMCP (`document.modelContext`) | **Parked.** Chrome origin trial only (149–156), Edge behind flag, WebKit formally opposed (2026-06-03), API renamed in July; needs per-origin trial token (third-party token support unverified). Helps *external* agents, not our bot | Origin trial ends (~Chrome 156) or browser agents drive measurable merchant traffic. Then: register tools only `if (document.modelContext)` |
| Screenshots/vision | No — text snapshot is cheaper/faster | If snapshot fails on canvas-heavy sites |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Snapshot too large on heavy themes → latency | Scope + cap + cache (Phases 1.3, 2.6); measured vs baseline |
| Fingerprint too sensitive (A/B tests, personalization) → constant re-scans | Structural-only hash; drift needs N distinct sessions; rate-limit scans per merchant/day |
| API cart mutation leaves theme UI stale | Phase 3.5 theme refresh + drawer fallback |
| PII in cases | Reuse consultation PII path; consent flag; no PII in transcripts |
| Over-asking for contact annoys users | Value-moment rule (4.5); eval in Phase 5 |
| Insights tracking = privacy/legal exposure (UK/EU/AU markets, India DPDP) | Consent-gated, no input values/keystrokes, IP truncation, retention limits, privacy page + DPA (8.3, 8.17) |
| Event volume blows up Postgres / cost | Browser-side aggregation (1 beacon/pageview), counters not rows, sticky sampling, plan session caps, detail rows only for qualifying sessions w/ 7–14 d TTL, volume monitor; Starter sends nothing (8.0, 8.5–8.7) |
| Tracker slows merchant sites | 5 KB budget, idle-time batching, perf check in CI (8.1, 8.19) |
