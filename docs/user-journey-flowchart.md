# shoppingmate.ai v0.1 — User Journey Flowchart & Architecture Map

**Date:** 2026-04-30 (last revised 2026-05-01)
**Source docs:** `docs/superpowers/roadmap.md`, `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`, `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`, `docs/strategy/2026-05-01-shoppingmate-strategy.md`
**Purpose:** Visualise the end-to-end journey across every supported platform, in two registers — the dumb (story) version, and the technical (boxes-and-arrows) version — so the architecture can be sanity-checked before code is written.

> **2026-05-01 revisions:** voice stack swapped to LiveKit + Gemini Live (ADR-0001); pricing model swapped from INR flat tiers to USD consumption-based with margin floor (strategy §5); per-conversation hard caps tightened to 15 turns / 3 min voice / 25 min duration; cost ceiling tightened to $0.15 per conversation. Story 3 + B1 architecture diagram + B5 cost notes + Decisions list updated below.

> **Phase tags used below:** `[P1]` = Phase 1 (rails only), `[P2]` = Phase 2 (dashboard + self-heal + Brand KB + overrides), `[P3]` = Phase 3 (billing + beta).

---

## PART A — The Dumb Version (story mode)

### Story 1 — Riya the merchant installs shoppingmate.ai `[P1]`

1. Riya runs a Shopify shop. We give her one line of HTML:
   `<script async src="cdn.shoppingmate.ai/v1.js" data-id="SM-RIYA01"></script>`
2. She pastes it into her theme's `<head>`. Saves. Walks away.
3. Behind the scenes, shoppingmate.ai starts thinking:
   - **"What kind of shop is this?"** → sniffs headers, HTML, well-known URLs → "Aha, Shopify."
   - **"What does she sell?"** → calls Shopify's product API → downloads every product into our DB.
   - **"Where are her Add-to-Cart and Checkout buttons?"** → opens her pages with a robot browser (Playwright), takes screenshots, asks Sonnet "where's the button?" → saves the answers.
   - **"Can I actually buy something?"** → does a fake test purchase to verify.
4. ~5–8 minutes later, the bubble on Riya's site goes live. She did nothing else.

### Story 2 — Riya logs into the dashboard `[P2]`

1. Riya goes to `app.shoppingmate.ai`, signs up, claims her merchant ID (`SM-RIYA01`).
2. **Default landing page:** conversation logs (showing real visitor chats from the last 24h), conversion stats (5 attributed sales today), persona picker, and a "Brand Knowledge" tab. **No "Recipe Cards" or "Selector Editor" in the primary nav** — the product was right by default.
3. She uploads her **Brand Knowledge Base**: a returns-policy PDF, a shipping-FAQ doc, a "voice & tone" Google Doc.
4. shoppingmate.ai chunks each file, indexes it, and stores it. From the next visitor onwards, the agent quotes these documents verbatim instead of guessing.
5. She picks a persona (`friend`) for her apparel brand, sets a lead webhook, configures auto-coupon-apply policy. Done. She closes the tab.

#### Story 2b — Riya gets an alert (rare safety-valve flow)

1. **Three weeks later** Riya redesigns her theme. The next visitor's `cart.add` succeeds, but the new "checkout" button selector our crawler picked (`button.go-to-checkout`) no longer exists — she renamed the class to `.checkout-cta`.
2. Within minutes, our daily recrawl smoke-test catches it. Riya gets an **email + dashboard banner**: _"Your checkout button stopped working. We think the new selector is `button.checkout-cta` — accept the fix?"_
3. She clicks **Accept**. Done. Total merchant time spent: ~10 seconds.
4. **Only if Riya wants to** can she open the Recipe-Card Editor (linked from the alert) and pick the element manually. That path exists but is **alert-driven, not browse-driven**. The product target is that <5% of merchants ever click into it (see roadmap §7 reliability targets).
5. Once a selector becomes a `merchant_override`, it is **permanent**: daily recrawl and the LLM auto-healer cannot touch it. If it ever breaks again, the same alert flow fires.

### Story 3 — Aman the visitor talks to the agent and buys `[P1]`

1. Aman lands on Riya's homepage. A bubble appears bottom-right.
2. He taps it and speaks: _"I want a blue shirt, size medium. What's your return policy?"_
3. The bubble joins a LiveKit room → his audio frames stream to the voice agent → Gemini 2.5 Flash Live (native audio in/out) understands him in one round trip.
4. For tool-using turns, Gemini's transcript is handed to Sonnet 4.6 (the tool-use brain). Because Riya uploaded a returns policy `[P2]`, the relevant chunk is already in the system prompt → Sonnet answers verbatim instead of hallucinating. (For simple greet/recommend turns with no tool calls, Haiku 4.5 handles the text — engineering invariant for the §5.4 margin floor.)
5. Sonnet calls "search products for blue shirt" → finds 3 → shows him a card.
6. Aman picks one → Sonnet calls "add this SKU to cart" → shoppingmate.ai calls Shopify's cart API → done.
7. Sonnet's reply text is fed back into Gemini Live → the voice persona speaks "Want me to try a discount code?"
8. Aman: _"Yes, SUMMER10."_ → Sonnet calls `coupons.try` → applied.
9. Aman: _"Pay."_ → Sonnet calls `checkout.handoff` → his browser is redirected to Shopify's REAL checkout.
10. Aman pays Shopify directly. **shoppingmate.ai never sees his card.**
11. Shopify's thank-you page loads → the bubble (still on the page) detects the URL → POSTs back to shoppingmate.ai: _"sale of $40, attribute it to session XYZ."_

### Story 4 — Same flow on a custom HTML site (no Shopify, no Woo, nothing) `[P1]`

- Same `<script>` tag. shoppingmate.ai can't recognise the platform → falls back to **DOM mode**.
- Now instead of calling APIs, shoppingmate.ai tells the bubble in Aman's browser to literally **click buttons on the page** like a robot puppet:
  - "click the size-M swatch", "set qty input to 1", "click the Add-to-Cart button".
- If a button selector breaks (merchant changed their CSS class), the cheap LLM (Haiku) figures out the new selector in real-time → caches it for next time `[P1]`.
- **Exception**: if that selector was a merchant override `[P2]`, the auto-healer is skipped — the bubble degrades to suggest mode AND fires an alert to the merchant dashboard.
- If even DOM control fails entirely: the bubble just tells Aman _"I couldn't add it for you — tap Add-to-Cart yourself, I'll keep helping."_ (Suggest mode.)

### Story 5 — Same flow on Wix / Squarespace / Magento / BigCommerce / Woo `[P1]`

- Each has its own platform adapter that knows the platform's guest cart API.
- The visitor experience is **identical**. The only thing that changes is which adapter file gets called inside shoppingmate.ai.

---

## PART B — The Technical Version (boxes & arrows)

### B1. System architecture (where everything lives)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          VISITOR'S BROWSER                               │
│   Hosted on: Shopify / Woo / Magento / BigCommerce / Wix / Squarespace   │
│              / arbitrary custom HTML site                                │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  gtag bundle  (cdn.shoppingmate.ai/v1.js, ~120KB gzip, vanilla JS)       │  │
│   │   - Shadow DOM widget UI (closed mode → no CSS leakage)            │  │
│   │   - WebSocket: agent channel (JSON, tool results, UI cards)        │  │
│   │   - LiveKit room: voice transport (WebRTC — see ADR-0001)          │  │
│   │   - DOM action executor (click / fill / read / wait)               │  │
│   │   - Conversion detector (thank-you page scrape)                    │  │
│   │   - Safety guard (blocks card / password fields)                   │  │
│   └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                       wss + https → api.shoppingmate.ai
                              │
┌─────────────────────────────┴───────────────────────────────────────────┐
│                         SHOPPINGMATE.AI BACKEND                                    │
│                                                                          │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│   │ uWebSockets.js   │   │ LiveKit Agent    │   │ HTTP API         │   │
│   │ agent channel    │   │ (voice gateway)  │   │ /v1/install      │   │
│   │                  │   │                  │   │ /v1/conversion   │   │
│   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘   │
│            │                      │                       │             │
│            ▼                      ▼                       ▼             │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│   │ LLM Loop         │   │ Gemini 2.5 Flash │   │ BullMQ Workers   │   │
│   │ Sonnet (tool-use)│   │ Live (native     │   │ - Onboarding [P1]│   │
│   │ + Haiku (default │   │ audio in/out)    │   │ - SmokeTest  [P1]│   │
│   │  text routing)   │   │ + Moderation API │   │ - Recrawl    [P2]│   │
│   │ + Brand KB [P2]  │   │ (10% sample)     │   │ - KBIndexer  [P2]│   │
│   └────────┬─────────┘   └──────────────────┘   └────────┬─────────┘   │
│            │                                              │             │
│            ▼                                              ▼             │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │  Adapter Dispatcher  (internal tool surface — not a protocol yet) │ │
│   │  ┌────────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌─────┐ ┌────┐│ │
│   │  │Shopify │ │ Woo  │ │Magento │ │  BC  │ │ Wix  │ │Sqsp │ │DOM ││ │
│   │  │Adapter │ │      │ │        │ │      │ │      │ │     │ │+Sug││ │
│   │  └───┬────┘ └──┬───┘ └───┬────┘ └──┬───┘ └──┬───┘ └──┬──┘ └─┬──┘│ │
│   └──────┼─────────┼─────────┼─────────┼────────┼────────┼──────┼───┘ │
└──────────┼─────────┼─────────┼─────────┼────────┼────────┼──────┼─────┘
           │         │         │         │        │        │      │
           ▼         ▼         ▼         ▼        ▼        ▼      ▼
  ┌─────────────────────────────────────────────────┐  ┌─────────────────┐
  │  Merchant's platform APIs (guest cart endpoints)│  │ DOM commands    │
  │  - {domain}/cart/add.js                         │  │ back to gtag    │
  │  - {domain}/wp-json/wc/store/v1/cart            │  │ via WebSocket   │
  │  - {domain}/rest/V1/guest-carts/{id}/items      │  │ (dom.click,     │
  │  - …                                            │  │  dom.fill, etc.)│
  └─────────────────────────────────────────────────┘  └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                  app.shoppingmate.ai (MERCHANT DASHBOARD) [P2]                  │
│                                                                          │
│   PRIMARY (every merchant uses):                                         │
│   - Login / signup                                                       │
│   - Conversation log viewer (default landing page)                       │
│   - Conversion / sales attribution dashboard                             │
│   - Brand Knowledge Base uploader (PDF / .docx / .md / txt)              │
│   - Persona / brand voice / tone config                                  │
│   - Lead webhook config                                                  │
│   - Catalog sync status                                                  │
│   - Coupon auto-apply policy (ask_first / auto_stack_best)               │
│   - Stripe Billing portal (Phase 3 — card on file, invoice history)      │
│                                                                          │
│   SAFETY VALVE (alert-driven, not browse-driven; <5% open it):           │
│   - Recipe-card editor + visual picker + permanent override locks        │
│   - Override-failing alerts (email + banner + one-click accept)          │
│   - Per-product price/title override                                     │
│                                                                          │
│   See roadmap §7 reliability targets — overrides are a failure mode,     │
│   not a feature. Default UX promotes Brand KB + persona + analytics.     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          STORAGE TIERS                                   │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────┐  │
│  │  Postgres        │   │  Redis           │   │  S3 / Cloudflare R2 │  │
│  │  (durable)       │   │  (24h TTL)       │   │  (durable / 7d)     │  │
│  │                  │   │                  │   │                     │  │
│  │  merchants       │   │  session:{id}    │   │  screenshots/  (7d) │  │
│  │  products        │   │  cart:{id}       │   │  transcripts/  (7d) │  │
│  │  selector_cache  │   │  quote:{id}      │   │  audio/        (7d) │  │
│  │   (+ source flag)│   │                  │   │  kb_raw/   [P2]     │  │
│  │  conversion_evts │   │                  │   │   (uploaded files,  │  │
│  │  billing_ledger  │   │                  │   │    durable until    │  │
│  │  brand_kb_chunks │   │                  │   │    merchant deletes)│  │
│  │   [P2]           │   │                  │   │                     │  │
│  │  override_alerts │   │                  │   │                     │  │
│  │   [P2]           │   │                  │   │                     │  │
│  └──────────────────┘   └──────────────────┘   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL DEPENDENCIES                              │
│  Anthropic API (Sonnet 4.6 = tool-use + onboarding extraction;          │
│                  Haiku 4.5 = default text routing + selector resolver)   │
│  Google Gemini API (gemini-2.5-flash-live, native audio in/out)         │
│  LiveKit Cloud (WebRTC voice transport — see ADR-0001)                  │
│  OpenAI Moderation (10% sample) •   Google Safe Browsing (install)      │
│  Playwright (onboarding crawl)                                          │
│  Stripe Billing (Phase 3 — consumption-based; NO Connect/Routes/take-rate│
│                  see roadmap §4 Phase 3 + strategy §5)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### B2. Merchant onboarding flowchart `[P1]`

```
[Merchant pastes <script> tag into <head>]
              │
              ▼
[gtag loads in the first visitor's browser]
              │
              ▼  POST /v1/install { merchantId, domain, UA, referrer }
[Backend: INSERT into merchants, status='onboarding'] (idempotent)
              │
              ▼  enqueue OnboardingJob(merchantId)
[BullMQ → OnboardingWorker]
              │
              ├─► Step 1: Pre-flight (5s)
              │       HEAD {domain} + Safe Browsing check
              │
              ├─► Step 2: Platform fingerprint (10s)
              │       inspect headers + HTML + /admin, /wp-json, /robots.txt
              │       output: shopify | woo | magento | bc | wix | sqsp | dom
              │       confidence < 0.6 → fall back to dom
              │
              ├─► Step 3: Catalog sync (1–3 min)
              │       API path:  hit platform's product API
              │       DOM path:  sitemap.xml + Playwright + LLM extract
              │       → write `products` rows
              │
              ├─► Step 4: Selector extraction (30s–2min)
              │       Playwright renders product/cart/checkout/policy pages
              │       Sonnet 4.6 (vision) returns CSS selectors
              │       → INSERT selector_cache (source='auto')
              │       → write merchants.adapter_config (JSONB)
              │
              ├─► Step 5: Smoke test (10s)
              │       synthetic cartAdd via Playwright
              │       success → status='live'
              │       fail    → degrade adapter_type, retry, mark accordingly
              │
              └─► Step 6: Notify
                      WS push to waiting gtag: {type:'onboarding_complete'}
                      Slack alert to internal channel
                                │
                                ▼
                         [Widget goes live]
```

### B3. Merchant dashboard journeys `[P2]`

#### B3a. Brand Knowledge Base upload

```
[Merchant logs into app.shoppingmate.ai → "Brand Knowledge" tab]
              │
              ▼  drag/drop PDF / .docx / .md / .txt
[Dashboard: PUT to S3 → kb_raw/{merchantId}/{file_id}.{ext}]
              │
              ▼  enqueue KBIndexerJob(merchantId, file_id)
[BullMQ → KBIndexerWorker]
              │
              ├─► extract text (pdf-parse / mammoth / markdown / plain)
              ├─► chunk (~800 tokens with 100-token overlap)
              ├─► (optional) embed via Haiku/embedding model
              │
              └─► INSERT brand_kb_chunks rows:
                  (merchant_id, file_id, chunk_idx, text,
                   embedding [opt.], source_filename, kind)
                                │
                                ▼
[Merchant sees: "policy.pdf — indexed — 12 chunks ready"]

[Next visitor session starts]
              │
              ▼  session bootstrap: fetch top-N relevant chunks
                 (or all chunks if total < ~10K tokens)
              │
              ▼  prepend chunks to system prompt with directive:
                 "Quote these merchant documents verbatim when relevant"
              │
              ▼
[LLM responses cite the merchant's own copy, not hallucinated]
```

#### B3b. Override + override-failing alert flow

```
[Merchant: "Recipe Cards" tab → picks 'checkout_button' selector]
              │
              ▼  visual element picker (clicks real element on live preview)
              │
              ▼  UPSERT selector_cache
                 (source='merchant_override',
                  resolved_selector='button.go-to-checkout',
                  locked=true)
              │
              ▼
[Override is now PERMANENT — auto-recrawl + Haiku healer skip it]

────────────────────────────────────────────────────────────
Later: that selector breaks (merchant changed their site)
────────────────────────────────────────────────────────────

[Visitor session: gtag dom.click('button.go-to-checkout') fails]
              │
              ▼
[Backend selector resolver]
              │
              ├─► Lookup selector_cache → HIT (source='merchant_override')
              │
              ├─► [DO NOT auto-heal — override is locked]
              │
              ├─► Speculatively run Haiku 4.5 to compute a candidate fix
              │       (NOT applied to runtime — just suggested)
              │
              ├─► INSERT override_alerts (
              │       merchant_id, selector_key, last_failed_at,
              │       suggested_selector, suggested_at, status='pending')
              │
              ├─► Email + dashboard banner to merchant:
              │       "Checkout button override is failing.
              │        Suggested fix: button.checkout-cta.
              │        [Accept] [Restore auto-detected] [Ignore]"
              │
              └─► This visitor's tool-call → degrades to SuggestAdapter
                  ws.send({type:'ui.show_message', text:'Tap the
                           checkout button on the page to continue'})

[Merchant clicks "Accept" in dashboard]
              │
              ▼  UPDATE selector_cache
                 SET resolved_selector=suggested_selector,
                     source='merchant_override',  -- still locked
                     locked=true
              │
              ▼  override_alerts.status='accepted'
              │
[Next session uses the new selector. Stays locked.]
```

### B4. Visitor conversation → purchase flowchart `[P1]` (with `[P2]` enhancements noted)

```
[Visitor lands on merchant page]
              │
              ▼
[gtag mounts Shadow DOM bubble; opens 2 WebSockets]
   • wss://api.shoppingmate.ai/v1/ws/{merchantId}/{sessionId}    (agent / JSON)
   • wss://api.shoppingmate.ai/v1/voice/{sessionId}              (audio frames)
              │
              ▼
[Backend: bootstrap session]
   • load merchants row + adapter_config
   • load persona system prompt
   • load brand_kb_chunks → inject into system prompt [P2]
              │
              ▼
[Visitor speaks: "I want a blue shirt size M. What's your returns policy?"]
              │
              ▼  audio → LiveKit room → Gemini 2.5 Flash Live (native audio in)
[Final transcript ready]
              │
              ▼  append to session history (Redis: session:{id})
              │
[LLM Loop — Sonnet 4.6, tools={visitor.*, product.*, cart.*, coupons.*, ui.*, lead.*, checkout.*}]
              │
              ├─► answers returns question by quoting Brand KB chunk verbatim [P2]
              │
              ▼  tool_call: product.search("blue shirt")
[Adapter Dispatcher → ShopifyAdapter.searchProducts]
              │
              ▼  SELECT FROM products WHERE merchant_id AND title ILIKE
[3 matches → returned to LLM]
              │
              ▼  tool_call: ui.show_card({product, variants})
[gtag renders product card inside Shadow DOM]
              │
              ▼  tool_call: cart.add(SKU=BLUE-SHIRT-001, variant={size:M}, qty:1)
[Adapter Dispatcher routes by merchants.adapter_type]
   ├─[shopify]─► POST {domain}/cart/add.js                  (cart token → Redis)
   ├─[woo]─────► POST {domain}/wp-json/wc/store/v1/cart/add-item
   ├─[magento]─► POST {domain}/rest/V1/guest-carts/{id}/items
   ├─[bc]──────► POST {domain}/api/storefront/carts/{id}/items
   ├─[wix]─────► stores/v1/cart endpoint
   ├─[sqsp]────► commerce cart endpoint
   ├─[dom]─────► ws.send({type:'dom.click', selector:...})  ← drives visitor's browser
   │                       │
   │                       └─[selector fails]─► see B5 self-heal
   │
   └─[suggest]─► ws.send({type:'ui.show_message', text:'Tap Add-to-Cart yourself'})
              │
              ▼
[LLM reply text → Gemini Live (native audio out, persona voice) → LiveKit room → gtag plays]
              │
              ▼  tool_call: coupons.try("SUMMER10")
[Adapter applies coupon → cart updated]
              │
              ▼  tool_call: checkout.handoff({mode:'redirect'})
[Backend resolves checkout URL per platform]
              │
              ▼  ws.send({type:'checkout.handoff', url:'https://{domain}/checkout'})
[gtag: window.location.assign(checkoutUrl)]
              │
              ▼
[Visitor lands on merchant's NATIVE checkout]
              │
              ▼  pays merchant directly (shoppingmate.ai never touches card data)
              │
[Thank-you page loads — /thank_you, /order-received, /order/...]
              │
              ▼  gtag detects URL pattern + scrapes order_id + total
              │  POST /v1/conversion {merchantId, sessionId, orderId, total_cents}
              │
[Backend: INSERT conversion_events + UPDATE billing_ledger]
              │
              ▼
        [Sale attributed]
```

### B5. Self-heal flowchart with override precedence

```
[gtag: dom.click('.add-to-cart-btn') → returns null OR mutation timeout (5s)]
              │
              ▼
[gtag → ws.send({type:'dom.snapshot', error:'selector_not_found',
                  selector_key:'add_to_cart', html:<truncated>, screenshot_id:...})]
              │
              ▼
[Backend selector resolver — checks SOURCE before deciding]
              │
              ├─► Lookup selector_cache (merchant_id, page_template_hash, key)
              │
              │   ┌───────────────────────────────────────────────────────┐
              │   │ source = 'merchant_override' [P2]   → LOCKED          │
              │   │   • DO NOT auto-heal                                  │
              │   │   • Run Haiku speculatively, store as suggestion      │
              │   │   • INSERT override_alerts row                        │
              │   │   • Email/banner merchant                             │
              │   │   • Degrade THIS turn → SuggestAdapter                │
              │   ├───────────────────────────────────────────────────────┤
              │   │ source = 'llm_resolved' or 'auto' [P1]                │
              │   │   • HIT cached selector → ws.send dom.retry           │
              │   │   • MISS → Haiku 4.5 vision: "find {key} in this DOM" │
              │   │       → INSERT selector_cache (source='llm_resolved') │
              │   │       → ws.send dom.retry with resolved selector      │
              │   ├───────────────────────────────────────────────────────┤
              │   │ 3 retries fail OR 5 LLM resolutions used this session │
              │   │   → degrade tool-call to SuggestAdapter               │
              │   │     ws.send ui.show_message ("tap it yourself")       │
              │   └───────────────────────────────────────────────────────┘
```

### B6. Daily recrawl `[P2]`

```
[Cron: daily per-merchant RecrawlJob]
              │
              ▼
[RecrawlWorker]
   ├─► Re-fingerprint platform (in case migrated)
   ├─► Diff catalog vs last run → upsert/delete products
   ├─► For each selector in selector_cache:
   │       ├─[source='merchant_override']─► SKIP (locked)
   │       │       └─► run smoke-test only; if fails → emit override_alert
   │       └─[source='auto' or 'llm_resolved']─► re-extract + smoke-test
   │               └─► drift detected → update + log
   └─► Run synthetic end-to-end purchase smoke test
           └─► fails → page on-call
```

---

## PART C — Database / storage map (what lives where, why)

| Where            | What                                                                                 | Why this tier                                                 | TTL                              | Phase                          |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------- | ------------------------------ |
| **Postgres**     | `merchants` (config, adapter_type, JSONB selectors, persona_id, status)              | Source of truth; queried every request                        | Forever                          | P1                             |
| **Postgres**     | `products` (catalog snapshot, variants JSONB)                                        | LLM-searchable; refreshed by recrawl in P2                    | Forever                          | P1                             |
| **Postgres**     | `selector_cache` (merchant_id, page_template_hash, selector_key, **source**, locked) | Cross-node shared; **source flag** drives override precedence | Forever                          | P1 (source flag matures in P2) |
| **Postgres**     | `conversion_events` (attributed sales)                                               | Billing + analytics ground truth                              | Forever                          | P1                             |
| **Postgres**     | `billing_ledger` (per-merchant monthly rollup)                                       | Invoicing + cost caps                                         | Forever                          | P1 (writes); P3 (invoicing)    |
| **Postgres**     | `brand_kb_chunks` (merchant_id, file_id, chunk_idx, text, embedding)                 | Injected into LLM system prompt at session start              | Forever (until merchant deletes) | **P2**                         |
| **Postgres**     | `override_alerts` (merchant_id, selector_key, suggested_selector, status)            | Powers dashboard banners + email notifications                | Forever (until resolved)         | **P2**                         |
| **Postgres**     | `merchant_users` (auth: email, hash, role)                                           | Dashboard login                                               | Forever                          | **P2**                         |
| **Redis**        | `session:{id}` — history, persona, lastTurnAt                                        | Hot path: every LLM turn reads/writes                         | 24h                              | P1                             |
| **Redis**        | `cart:{id}` — opaque adapter cart token                                              | Per-session, ephemeral                                        | 24h                              | P1                             |
| **Redis**        | `quote:{id}` — price snapshot shown to visitor                                       | Stability across one turn                                     | 24h                              | P1                             |
| **S3 / R2**      | `screenshots/{merchantId}/{ts}.png`                                                  | Big blobs for LLM vision debugging                            | 7d                               | P1                             |
| **S3 / R2**      | `transcripts/{sessionId}.json`                                                       | QA review then auto-delete                                    | 7d                               | P1                             |
| **S3 / R2**      | `audio/{sessionId}/{turnId}.opus`                                                    | TTS sample for QA                                             | 7d                               | P1                             |
| **S3 / R2**      | `kb_raw/{merchantId}/{file_id}.{ext}`                                                | Original uploaded Brand KB files (re-indexable)               | Until merchant deletes           | **P2**                         |
| **Per-node LRU** | Compiled persona prompts, adapter HTTP clients, hot KB chunks                        | Avoid re-fetch on every turn                                  | ~1 min                           | P1/P2                          |

**Dumb explanation of the tiers:**

- **Postgres = filing cabinet.** Things that must survive forever (who the merchant is, what they sell, who bought what, what overrides they've locked, what their brand says).
- **Redis = sticky note on a desk.** Things you need fast for an hour or two, then can throw away (one visitor's chat).
- **S3 = warehouse.** Big bulky things (screenshots, audio, original PDFs) where speed doesn't matter but storage is cheap.

---

## PART D — Pricing & money discipline

**Premise:** v0.1 targets D2C merchants (apparel / electronics / services). D2C uses static list pricing — no surge, no per-visitor personalisation. So `products.price_cents` from catalog sync is a reliable source of truth.

### The three rules

1. **DB is trusted for cards.** Widget product cards display price from `products.price_cents`. No per-page live scrape needed. Simple, fast, deterministic.
2. **Voice never speaks numeric prices.** TTS pronouncing "₹1,234.56" is awkward and risks errors. Agent paraphrases and points: _"your cart total on screen is around twelve hundred"_, _"that's a little under two thousand"_. Defends against catalog drift even with reliable D2C pricing.
3. **Merchant corrects via dashboard `[P2]`.** If a price scrape is wrong, merchant edits `products.price_cents` per-row in the catalog tab. Edit is locked (`source='merchant_override'`, same pattern as selectors) → daily recrawl skips it. Email alert if the locked price diverges from the live page.

### What this lets us delete vs. earlier proposals

| Earlier idea (now dropped)                  | Why dropped                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `quote:{sessionId}` Redis quote-freeze      | Not needed. Visitor sees the live cart on the merchant's page; we don't intermediate.                                |
| Verify-before-commit price re-fetch         | Not needed. Cart-add lands on the merchant's cart page; price discrepancy is visible to the visitor before they pay. |
| Live DOM-scrape of cart-total on every turn | Not needed for D2C. Optional path for v0.2 if a non-D2C merchant ever joins.                                         |
| Post-LLM regex check for unquoted currency  | Replaced by the simpler "voice never speaks numeric prices" system-prompt rule.                                      |

### Edge cases acknowledged

- **"What's my cart total?"** → agent uses `cart.get` (DB-side total) and paraphrases ("around twelve hundred"). For exactness, defers to the cart page on screen.
- **Flash sales / 1-hour discounts** → catalog freezes at install in P1; daily recrawl in P2 catches them within 24h. For closed beta this is acceptable; flag in onboarding docs.
- **Voice-only contexts** (driving, accessibility) — out of scope for v0.1; widget assumes visitor has eyes on screen.

---

## PART E — Coupon UX

### Phase 1 — manual code only

Per roadmap §4 Phase 1: visitor or agent supplies a specific code. One tool:

| Tool                | Trigger                   | Behaviour                                   |
| ------------------- | ------------------------- | ------------------------------------------- |
| `coupons.try(code)` | Visitor says/types a code | Adapter applies; returns updated cart state |

No discovery, no suggestion. If asked "any discounts?", agent says: _"You'll need a code from the merchant — happy to apply one if you have it."_

### Phase 2 — discovery + suggestion

```
Visitor: "Any discounts?" / "What's the best coupon?"
              │
              ▼  tool_call: coupons.list  OR  coupons.suggest(cart)
[Adapter Dispatcher → CouponsService]
              │
              ▼  SELECT * FROM coupons
                 WHERE merchant_id AND (expires_at IS NULL OR expires_at > now())
                 AND min_cart_value <= cart.subtotal
              │
              ▼  rank by expected discount on current cart
              │
[Agent: "FIRSTORDER10 takes 10% off — about a hundred and twenty rupees.
        Want me to apply it?"]
              │
              ▼  (visitor confirms — or auto-apply if merchant set 'auto-stack-best')
              │
              ▼  tool_call: coupons.try("FIRSTORDER10")
              │
[Cart updated, new total visible on page]
```

### New tools (Phase 2)

| Tool                    | Returns                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `coupons.list`          | All known active codes for this merchant: `[{code, description, expiry, min_cart_value, max_discount}]` |
| `coupons.suggest(cart)` | Best applicable code given current cart, with reasoning. Server-ranked, not LLM-ranked.                 |
| `coupons.try(code)`     | (Same as P1) Apply specific code, return new cart state.                                                |

### Discovery sources (populates `coupons` table during recrawl)

1. **Scrape merchant's coupon page** — most D2C sites have `/discounts`, `/offers`, `/promo`. Playwright + Sonnet 4.6 extract code + rules.
2. **Observed-codes table** — codes that visitors have successfully applied in past sessions (we already see them via `coupons.try` results).
3. **Merchant-entered in dashboard** — explicit code list with description, expiry, min-cart, max-discount, locked (won't be overwritten by recrawl).

### New schema (Phase 2)

```sql
coupons (
  merchant_id      text REFERENCES merchants(id),
  code             text NOT NULL,
  source           text NOT NULL,         -- 'scraped' | 'observed' | 'merchant_entered'
  description      text,
  min_cart_value_cents integer DEFAULT 0,
  max_discount_cents   integer,
  percent_off      integer,
  flat_off_cents   integer,
  expires_at       timestamptz,
  last_seen_at     timestamptz,
  success_count    integer DEFAULT 0,
  fail_count       integer DEFAULT 0,
  locked           boolean DEFAULT false, -- merchant_entered ⇒ true
  PRIMARY KEY (merchant_id, code)
);
```

### Auto-apply policy

Per-merchant setting in dashboard:

- **`ask_first`** (default) — agent suggests, visitor confirms before apply. Highest trust.
- **`auto_stack_best`** — agent silently applies the best code at cart-add. Higher conversion, lower trust.

Default to `ask_first` for closed beta; promote `auto_stack_best` after merchant sees it's safe.

---

## PART F — Architecture sanity check

### What's strong

1. **One install primitive (gtag).** No per-platform install variant → matches the 60-second install promise.
2. **Adapter abstraction is the right seam.** A single `Adapter` interface keeps the LLM tool surface platform-agnostic. New platform = one new file.
3. **Zero PCI scope.** shoppingmate.ai never sees card data; payment is always a redirect to the merchant's native checkout.
4. **Three storage tiers match access patterns.** Hot/warm/cold split is principled — no over-engineering with extra DBs.
5. **Self-heal + override precedence is explicit.** Single `source` column on `selector_cache` cleanly determines whether the LLM healer can touch a selector. No ambiguous "should we re-resolve?" logic.
6. **Brand KB is additive, not invasive.** Chunked text + system-prompt injection — no fine-tuning, no separate RAG service, no new vector DB required (pgvector is enough).
7. **Pricing discipline removes a whole risk class.** D2C-only assumption + DB-trusted cards + voice-never-quotes-numbers means hallucinated prices can't reach the visitor. No quote-freeze infra needed.
8. **Coupon UX is modelled before built.** Phase 1 ships only `coupons.try`, but the verb shape (`list` / `suggest` / `try`) is fixed now → Phase 2 work is additive, not a repaint.
9. **Cost ceilings baked into runtime — margin floor is mechanism, not hope.** Per-conv hard caps (15 turns / 3 min voice / 25 min) + Haiku-default text routing + voice-fairness surcharge ($0.30 per voice conv above 20% voice ratio) + $0.15 per-conv hard cost-cut. Worst-case GM ≥ 70% on every plan including Pro under 100% voice abuse. See strategy §5.4 + roadmap §6 guardrails.

### Things to watch (not bugs — risks to load-test)

1. **One WebSocket (agent channel) + one LiveKit room per visitor.** LiveKit owns the voice transport (WebRTC) and is hosted on LiveKit Cloud for v0.1 — verify under real traffic before beta and revisit self-host once we hit ~500 paying merchants.
2. **DOMAdapter requires the visitor's tab to stay open mid-cart.** If they navigate away, cart state can desync. Spec mitigates with opaque cart token in Redis — worth a stress test.
3. **Conversion attribution = gtag scrape in Phase 1.** Brittle if merchant changes thank-you page HTML. Acknowledged; switches to platform webhooks in Phase 2. OK for closed beta.
4. **Selector cache key = `(merchant_id, page_template_hash, selector_key)`.** If a merchant has many product templates, hash space grows. Phase 2 daily recrawl validates entries; Phase 1 → just monitor cache size.
5. **One persona per merchant set at provision time.** No A/B and no per-page persona swapping. Acceptable for v0.1, parked for v0.2.
6. **Catalog freezes at install in Phase 1** (recrawl is Phase 2). Out-of-stock items will go stale. Acceptable for closed beta if merchants are warned.
7. **Brand KB chunk size budget.** If merchant uploads 200 pages of policy, can't shove everything into the system prompt. Need a retrieval step (top-N by embedding similarity) — confirm whether that's in scope for P2 or "naïve concat under N tokens, RAG retrieval in v0.2".
8. **Override-failing alerts could spam the merchant.** If a merchant's site is broken globally, every session fires the same alert. Need dedup window (e.g. one alert per `(merchant, selector_key)` per 24h) — confirm.

### Decisions made (no longer open)

- ~~Brand KB: RAG vs naïve concat~~ → **decided**: naïve concat for KBs ≤ 8K tokens; top-K (k=6) fallback for larger. Builds the fallback only when first merchant trips the budget.
- ~~Pricing integrity (quote-freeze, regex checks)~~ → **dissolved by D2C assumption**: DB-trusted cards + voice-never-quotes + dashboard-correctable. See Part D.
- ~~Verb-graph manifest as unifying abstraction~~ → **scoped down**: only DOMAdapter (~12% of merchants) gets multi-selector fallback chains in `adapter_config`. Platform adapters keep their thin API wrappers.
- ~~Take-rate / Razorpay Routes / Stripe Connect~~ → **dropped permanently**: consumption-based SaaS via Stripe Billing (revised 2026-05-01 — Starter $30/100 / Growth $99/500 / Scale $299/2,000 / Pro $799/10,000 / Enterprise; top-up packs replace overage; no trial / no free tier — see strategy §5 + roadmap §4 Phase 3). shoppingmate.ai is not a payment processor; merchant's existing checkout/payouts are unchanged.
- ~~Override editor as headline dashboard feature~~ → **reframed as safety valve**: alert-driven, not browse-driven; <5% of merchants ever click in. See roadmap §7. The product target is "right by default" (≥99.5% on platform adapters, ≥95% on DOMAdapter).

### Open questions worth answering before Phase 2 implementation

1. **Auth model for `app.shoppingmate.ai`:** email/password + magic link? OAuth (Google/GitHub)? Roadmap says "Login + signup" but no SSO requirement — pick the simplest (passwordless email).
2. **Override visual picker — preview iframe of merchant's site:** can we sandbox it in our dashboard, or do we need to inject a "picker mode" into gtag itself? The latter is cleaner UX but couples dashboard to widget version.
3. **Coupon auto-apply default:** ship with `ask_first` (recommended for trust) or `auto_stack_best` (better conversion)? Suggest `ask_first` for closed beta, A/B in v0.2.
4. **Multi-region from day 1?** India + US merchants on one backend = voice STT/TTS round-trip latency could hurt. Decide before infra is provisioned.
5. **How are merchant IDs (`SM-XXXX`) provisioned in Phase 1?** Spec says "manually for beta merchants" — needs a one-page admin script.
