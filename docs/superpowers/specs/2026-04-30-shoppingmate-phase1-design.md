# shoppingmate.ai Phase 1 — Working Widget End-to-End (All Platforms)

**Date:** 2026-04-30 (last revised 2026-05-01)
**Owner:** Karan (Calmosis)
**Roadmap:** `docs/superpowers/roadmap.md` § Phase 1
**Status:** Draft for review

> **2026-05-01 revisions:** voice stack swapped to LiveKit Agents (WebRTC) + Gemini 2.5 Flash Live native audio — see [ADR-0001](../../adr/2026-05-01-voice-stack-livekit-gemini-live.md). All references to Whisper STT / ElevenLabs TTS / second-WebSocket-for-audio-frames in this doc are superseded by the ADR. Phase 1 plans 1+2 are merged with no voice code on disk; the swap costs zero rework.

---

## 1. Goal

Ship the rails. A merchant pastes one `<script>` tag. Within ~5-8 minutes, an AI sales agent (voice + text) is live on their site, autonomously building carts and handing off to their native checkout. Works on Shopify, WooCommerce, Magento, BigCommerce, Wix, Squarespace, and arbitrary custom websites — without the merchant writing a single line of code.

Phase 1 ships **the runtime only**. No merchant dashboard, no billing, no recrawl/healing — those are Phase 2 and 3.

---

## 2. In scope / out of scope

**In scope:**

- gtag JS bundle (Shadow DOM widget)
- Backend orchestrator (WebSocket, LLM tool-call loop, internal adapter dispatcher over the v0.1 tool surface — see §6.2)
- Onboarding worker (auto-detect platform, sync catalog, extract selectors → `merchant.json`)
- 7 platform adapters + 1 fallback (SuggestAdapter)
- Runtime selector resolver (Haiku 4.5)
- Voice stack (LiveKit Agents WebRTC transport + Gemini 2.5 Flash Live native audio — see [ADR-0001](../../adr/2026-05-01-voice-stack-livekit-gemini-live.md))
- 8 personas (system-prompt versioning under `config/persona-prompts/`)
- **Brand KB retrieval path** (table + chunk-fetch + system-prompt injection — empty in Phase 1, populated by Phase 2 upload UI)
- Payment handoff (redirect to merchant's native checkout)
- Conversion attribution
- Postgres / Redis / S3 storage
- Provisioning API (`POST /v1/install` returns merchantId)

**Out of scope (Phase 2/3):**

- Merchant dashboard (`app.shoppingmate.ai`) — login, signup, all UI
- Brand KB **upload UI** (the retrieval path exists in Phase 1; the upload surface is Phase 2)
- Recipe-card editor / visual element picker / **permanent override locks** (the retrieval path reads `selector_cache.source='merchant_override'` in Phase 1, but no UI to create overrides yet)
- Daily recrawl / drift detection / smoke tests
- Coupon discovery pipeline (manual codes only in Phase 1)
- Lead webhook config UI (hardcoded webhook in Phase 1)
- Persona config UI (one persona per merchant, set via env in Phase 1)
- Billing (cost ledger writes happen, but no invoicing)
- Fraud signals beyond Safe Browsing on install
- E2E test suite (smoke tests only in Phase 1)

---

## 3. Architecture

```
                       Visitor's browser tab
                              │
                              ▼
                    ┌────────────────────┐
                    │  gtag bundle (CDN) │   ← single <script> tag
                    │  - Shadow DOM UI   │
                    │  - WebSocket conn  │
                    │  - Action executor │
                    │  - Voice I/O       │
                    └─────────┬──────────┘
                              │
                              │  WebSocket (JSON)
                              │
                              ▼
                    ┌────────────────────┐
                    │  shoppingmate.ai backend     │
                    │  (uWebSockets.js)  │
                    └─────────┬──────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────┐  ┌─────────────┐  ┌──────────────┐
        │ LLM loop │  │ Adapter     │  │ Voice gateway│
        │ (Sonnet) │  │ dispatcher  │  │ (STT+TTS)    │
        └──────────┘  └──────┬──────┘  └──────────────┘
                             │
              ┌──────────────┼──────────────────┬──────────┐
              ▼              ▼                  ▼          ▼
        ┌───────────┐  ┌───────────┐  ┌───────────────┐  ┌──────────┐
        │ Shopify-  │  │ Woo-      │  │ Magento /     │  │ DOM-     │
        │ Adapter   │  │ Adapter   │  │ BigCommerce / │  │ Adapter  │
        │           │  │           │  │ Wix /         │  │ + Suggest│
        │           │  │           │  │ Squarespace   │  │ fallback │
        └─────┬─────┘  └─────┬─────┘  └───────┬───────┘  └─────┬────┘
              │              │                │                │
              ▼              ▼                ▼                ▼
        Merchant's      Merchant's       Merchant's       Merchant's
        Shopify API     Woo Store API    REST APIs        DOM (via gtag)
                              │
                              ▼
                  ┌─────────────────────┐
                  │  Storage tier       │
                  │  - Postgres         │  ← merchants, products, sessions, selector_cache, conversion_events, billing_ledger
                  │  - Redis (24h TTL)  │  ← session history, transcripts, in-flight cart state
                  │  - S3/R2 (7d TTL)   │  ← screenshots, audio blobs
                  └─────────────────────┘

                  ┌─────────────────────┐
                  │  BullMQ workers     │
                  │  - OnboardingWorker │  ← runs once per new merchant
                  │  - SmokeTestWorker  │  ← runs per session-start
                  └─────────────────────┘
```

---

## 4. Install model — gtag snippet

### 4.1 What the merchant pastes

```html
<script
  async
  src="https://cdn.shoppingmate.ai/v1.js"
  data-id="SM-XXXX"
></script>
```

That's it. One line in `<head>`. No npm install, no OAuth, no dashboard signup required for the install itself (signup happens separately at `app.shoppingmate.ai` in Phase 2; in Phase 1 the merchantId is provisioned manually for beta merchants).

### 4.2 What happens on first load

1. gtag fetches `cdn.shoppingmate.ai/v1.js` (~120KB gzip, vanilla JS, no framework dependency).
2. gtag reads `data-id="SM-XXXX"` from its own script tag.
3. gtag POSTs `/v1/install { merchantId, domain: location.hostname, userAgent, referrer }` to record the install (idempotent — first call kicks off onboarding; later calls are no-ops).
4. gtag opens a WebSocket: `wss://api.shoppingmate.ai/v1/ws/{merchantId}/{sessionId}` (sessionId is a fresh UUID per page load).
5. gtag mounts a Shadow DOM root, renders the bubble UI in bottom-right corner.
6. If onboarding for this merchant is not yet complete, gtag enters "warming up" state — bubble shows "I'll be ready in a few minutes." This only happens on the very first visitor of a brand-new install; subsequent visitors get the live agent.

### 4.3 Bundle constraints

- ≤120KB gzipped.
- Vanilla JS — no React/Vue/Svelte runtime in the bundle.
- Shadow DOM root with `mode: 'closed'` so merchant CSS cannot leak in.
- One CSS file inlined into the Shadow root.
- Audio I/O via Web Audio API + MediaRecorder.
- No third-party SDKs in the bundle (no Sentry, no Mixpanel, no GA — error reporting goes through our own WebSocket).

---

## 5. Onboarding flow

### 5.1 Trigger

`POST /v1/install` enqueues `OnboardingJob(merchantId, domain)` on BullMQ.

### 5.2 OnboardingWorker steps (~3-8 min total)

```
Step 1: Pre-flight (5s)
  - HEAD request to https://{domain}
  - Reject if Safe Browsing flags it
  - Set merchants.status = 'onboarding'

Step 2: Platform fingerprint (10s)
  - Fetch homepage
  - Inspect headers (X-Powered-By, X-Shopify-Stage, etc.)
  - Inspect HTML (meta generator, JS bundle paths, /admin signatures)
  - Inspect well-known paths (/wp-json/, /admin/, /robots.txt)
  - Output: adapter_type ∈ {shopify, woo, magento, bigcommerce, wix, squarespace, dom}
  - Confidence score 0.0-1.0; below 0.6 → fallback to DOM

Step 3: Catalog sync (1-3 min, parallel where possible)
  - For platform-detected: hit the platform's catalog API
    - Shopify: GraphQL Admin API (requires merchant token in Phase 2; in Phase 1, public storefront /products.json)
    - Woo: /wp-json/wc/store/v1/products
    - Magento: /rest/V1/products (guest)
    - BigCommerce: /api/storefront/products
    - Wix: stores/v1/products/query
    - Squarespace: ?format=json on collection pages
  - For DOM: sitemap.xml crawl (cap 500 URLs) + Playwright render + LLM extraction
  - Write to products table: sku, title, description, image_url, product_url, variants JSONB, price_cents, currency, in_stock

Step 4: Selector extraction (30s-2min)
  - Pick 1 representative product page, the cart page, the checkout page, a policy page
  - Playwright renders + screenshots each
  - Sonnet 4.6 prompt: "Given this DOM + screenshot, return JSON with selectors for: add_to_cart_button, quantity_input, variant_selector_template, cart_url, cart_page_total, checkout_button, coupon_field, coupon_apply_button, line_item_remove_button, thank_you_order_id, thank_you_total"
  - Compute page_template_hash for each page type (sha256 of normalized DOM skeleton)
  - For platform adapters (Shopify/Woo/Magento/BigCommerce/Wix/Squarespace), this step is **skipped entirely** — the selectors and URLs are known per-platform and live in code under `config/platform-defaults/{platform}.json`. Only the DOM adapter runs the LLM extraction.
  - Write to merchants.adapter_config JSONB:
      {
        selectors: { add_to_cart, qty_input, variant_swatch, cart_url, checkout_btn, coupon_field, coupon_apply, ... },
        page_templates: { product: 'sha256:abc...', cart: 'sha256:def...' },
        thank_you_selectors: { order_id, total }
      }

Step 5: Smoke test (10s)
  - Spin a Playwright tab, run a synthetic cartAdd against the first product
  - If success → merchants.status = 'live'
  - If fail → degrade adapter_type to 'dom' or 'suggest', retry, mark status accordingly

Step 6: Notify
  - WebSocket push to any waiting gtag instance: { type: 'onboarding_complete' }
  - Webhook to internal Slack channel
```

### 5.3 What gets stored

`merchants` row, fully populated:

```
id, domain, platform, platform_confidence, status,
adapter_type, adapter_config (JSONB: selectors, page templates, API endpoints),
cart_url_template, checkout_url, coupon_field_selector,
policy_urls (JSONB: returns, shipping, privacy, ToS),
installed_at, last_indexed_at
```

Plus N rows in `products` and (initially empty) `selector_cache`, `conversion_events`, `billing_ledger`.

---

## 6. Runtime flow

### 6.1 Tool-call loop

The LLM (Sonnet 4.6 via OpenRouter) is given a fixed tool surface. Every visitor turn runs:

```
1. STT (if voice input) → text transcript
2. Append { role:'user', content: transcript } to session history
3. Call LLM with tools=[visitor.*, product.*, cart.*, coupons.*, ui.*, lead.*, kb.*]
4. For each tool_call in response:
     - Dispatch to adapter or internal handler
     - Append tool result to history
5. If LLM returns final assistant text:
     - Render in widget (text card)
     - TTS → audio stream → gtag plays
6. Cap: 30 tool-calls per turn, 10 turns per session, 60 min per session
```

**Session-start system prompt assembly:**

```
[persona prompt from config/persona-prompts/{persona_id}.md]
+
[merchant brand context: name, domain, policy URLs, top categories]
+
[top-N brand KB chunks for the session, retrieved from brand_kb_chunks
 by embedding-similarity to the visitor's first query — empty in Phase 1
 since upload UI is Phase 2; the retrieval call is wired and returns []]
+
[available tools]
```

### 6.2 Tool surface (internal — naming convention, not a public protocol in v0.1)

| Tool               | Purpose                                                                                                                            | Adapter call                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `visitor.identify` | Capture name/email if offered                                                                                                      | DB write                            |
| `product.search`   | Find products matching free-text query (within this merchant's catalog)                                                            | adapter.searchProducts              |
| `product.get`      | Fetch full product details by SKU                                                                                                  | adapter.getProduct                  |
| `cart.add`         | Add SKU + variant + qty                                                                                                            | adapter.cartAdd                     |
| `cart.update`      | Change qty / remove line                                                                                                           | adapter.cartUpdate                  |
| `cart.get`         | Fetch current cart state                                                                                                           | adapter.cartGet                     |
| `coupons.try`      | Apply a specific coupon code (P1: only verb in coupon family — discovery / suggestion verbs are P2)                                | adapter.couponApply                 |
| `kb.lookup`        | Semantic search over merchant's Brand KB chunks                                                                                    | pgvector query on `brand_kb_chunks` |
| `ui.show_card`     | Render product/cart/coupon card in widget — **prices on cards are sourced from `products.price_cents`, never composed by the LLM** | gtag                                |
| `ui.show_message`  | Render plain text bubble                                                                                                           | gtag                                |
| `lead.capture`     | POST to merchant's lead webhook                                                                                                    | HTTP                                |
| `checkout.handoff` | Trigger redirect to merchant's checkout                                                                                            | gtag                                |

**Pricing rule baked into the tool surface:** the LLM cannot freely emit numeric prices. Prices reach the visitor only via `ui.show_card` (which renders from `products.price_cents`) or by paraphrasing what's visible on the merchant's page. See §8.5 for the voice-discipline system-prompt rule.

### 6.3 Adapter dispatch

```
Backend receives tool_call e.g. cart.add({sku:'SHIRT-001', variant:{size:'M'}, qty:1})
        │
        ▼
Look up merchants.adapter_type
        │
        ▼
Route to:
  shopify       → ShopifyAdapter.cartAdd()
  woo           → WooAdapter.cartAdd()
  magento       → MagentoAdapter.cartAdd()
  bigcommerce   → BigCommerceAdapter.cartAdd()
  wix           → WixAdapter.cartAdd()
  squarespace   → SquarespaceAdapter.cartAdd()
  dom           → DOMAdapter.cartAdd() ─→ ws.send({type:'dom.click', selector:...})
  suggest       → SuggestAdapter.cartAdd() ─→ ws.send({type:'ui.show_message', text:'Tap Add to Cart on the page'})
```

---

## 7. Adapter system

### 7.1 Common interface

```ts
interface Adapter {
  searchProducts(merchant, query): Promise<Product[]>;
  getProduct(merchant, sku): Promise<Product>;
  cartAdd(merchant, session, sku, variant, qty): Promise<CartState>;
  cartUpdate(merchant, session, lineId, qty): Promise<CartState>;
  cartGet(merchant, session): Promise<CartState>;
  couponApply(merchant, session, code): Promise<CartState>;
  checkoutUrl(merchant, session): Promise<string>;
}
```

### 7.2 Tier 1 — API-native adapters (~85% of merchants)

For each of Shopify, Woo, Magento, BigCommerce, Wix, Squarespace — the adapter calls the platform's public guest cart API directly from the shoppingmate.ai backend. Examples:

- **ShopifyAdapter.cartAdd:** `POST {domain}/cart/add.js { id: variantId, quantity }`
- **WooAdapter.cartAdd:** `POST {domain}/wp-json/wc/store/v1/cart/add-item { id, quantity }` (uses `Nonce` header from Store API)
- **MagentoAdapter.cartAdd:** `POST {domain}/rest/V1/guest-carts/{cartId}/items { cartItem: {...} }`
- **BigCommerceAdapter.cartAdd:** `POST {domain}/api/storefront/carts/{cartId}/items`

Each adapter gets its own file and unit tests against recorded fixtures. Cart state is stored merchant-side; we keep an opaque cart token in `sessions` (Redis, 24h TTL).

### 7.3 Tier 2 — DOMAdapter (~12% of merchants)

For custom websites with no recognized API. The adapter doesn't call any HTTP API on the merchant — it instructs gtag to drive the visitor's browser.

```
DOMAdapter.cartAdd(merchant, session, sku, variant, qty):
  1. Look up merchant.adapter_config.selectors
  2. Look up product.product_url (from products table) → if not on it, navigate
  3. Build action sequence:
       [
         { type:'dom.navigate', url: product_url },
         { type:'dom.click', selector: variant_swatch.replace('{value}', variant.color) },
         { type:'dom.fill',  selector: qty_input, value: String(qty) },
         { type:'dom.click', selector: add_to_cart },
         { type:'dom.wait_for', selector: '.cart-count', condition: 'mutation' },
         { type:'dom.read', selector: '.cart-count' }
       ]
  4. ws.send each action; await ack from gtag
  5. Return final cart state to LLM
```

gtag's action executor implements:

```
dom.navigate  → history.pushState + dispatch event (or location.assign for hard nav)
dom.click     → document.querySelector(sel).click()
dom.fill      → setNativeValue(input, value)  // React-safe
dom.read      → return el.textContent / .value / .dataset[*]
dom.wait_for  → MutationObserver or polled check, 5s timeout
dom.snapshot  → return html + screenshot when something fails
```

**Safety layer in gtag (always-on):**

- Block any selector matching `[type="password"]`, `[name*="card"]`, `[name*="cvv"]`, `[name*="cvc"]`, iframe contents
- Block `dom.navigate` to off-domain URLs
- Cap 50 actions per turn, 200 per session

### 7.4 Runtime selector resolver

When a Tier-2 selector returns null or the wait-for times out:

```
gtag → ws.send({ type:'dom.snapshot', error:'selector_not_found',
                 selector_key:'add_to_cart', html:<truncated>, screenshot_id:... })

**Runtime selector lookup order (every Tier-2 action):**
  selector_cache → merchants.adapter_config.selectors → call resolver

Backend:
  1. Read selector_cache (merchant_id, page_template_hash, selector_key)
       - if row exists AND source='merchant_override':
           DO NOT auto-heal. Mark last_test_passed=false.
           Skip the LLM resolver entirely.
           Set suggested_replacement (call Haiku for a hint, store but don't apply).
           Degrade THIS tool-call to SuggestAdapter immediately.
           Phase 2 alerter will email the merchant; Phase 1 just logs.
       - if row exists AND source ∈ {'auto','llm_resolved'}: try resolved_selector first
       - else: continue to step 2
  2. Call Haiku 4.5: "Need add_to_cart_button on this DOM. Return CSS selector."
  3. Cache the result in selector_cache (source='llm_resolved'). Do NOT modify merchants.adapter_config — selector_cache shadows it. (Phase 2 daily recrawl may promote stable healed selectors back to adapter_config.)
  4. Send retry to gtag

If 3 retries fail → degrade this single tool-call to SuggestAdapter
  ws.send({ type:'ui.show_message', text:'I couldn\'t add it for you — tap Add to Cart on the page' })
```

Selector cache cap: 5 LLM resolutions per session (cost cap). Beyond that, hard fail to suggest.

**Override-permanence rule (honored Phase 1, surfaced Phase 2):** any row with `source='merchant_override'` is **never** overwritten by the auto-resolver or the daily recrawl. The only way to change it is a fresh merchant action in the dashboard. This rule is enforced in code from Phase 1 even though no UI exists yet to create overrides.

### 7.5 Tier 3 — SuggestAdapter (~3-5% of merchants)

For sites where DOM control is impossible (closed Shadow DOM widgets, Cloudflare bot challenges, sites that aggressively block synthetic events). The adapter never tries to touch the DOM — it tells the visitor what to do:

```
SuggestAdapter.cartAdd → ws.send({
  type:'ui.show_message',
  text:'I found the Blue Shirt size M for ₹1,200. Tap "Add to Cart" on the page to grab it, and I'll keep helping you shop.'
})
```

The agent stays useful for product Q&A, recommendations, coupon hints, lead capture — it just can't drive the cart.

---

## 8. Voice + persona stack

> Authoritative reference: [ADR-0001 — Voice stack: LiveKit + Gemini Live](../../adr/2026-05-01-voice-stack-livekit-gemini-live.md). The subsections below describe the integration shape only; vendor / model choices live in the ADR.

### 8.1 Transport — LiveKit Agents (WebRTC)

- gtag opens a **single LiveKit room** to `voice.shoppingmate.ai` (no second raw WebSocket; LiveKit's SDK handles audio frames, jitter buffer, packet loss, echo cancellation, reconnection).
- The voice gateway runs as a LiveKit Agent server. Each visitor session = one room participant on each side (visitor browser + voice agent).
- Audio is end-to-end inside the LiveKit room. The agent channel WebSocket (JSON, tool results, UI cards) stays separate and unchanged.

### 8.2 Voice model — Gemini 2.5 Flash Live (native audio in/out)

- The LiveKit Agent forwards visitor audio frames to a Gemini Live session. Gemini handles STT, intent, and TTS in one round trip — see ADR-0001 §1.
- For tool-using turns (cart.add, cart.update, etc.), the agent intercepts Gemini's transcribed text and routes it to **Sonnet 4.6** for the tool-call loop, then feeds the tool results + Sonnet's reply back into Gemini for the spoken response.
- Voice persona is a system-prompt **voice descriptor** (e.g. "warm female mid-tone, calm cadence") plus a Gemini native-voice selection. Eight prompt files in `config/persona-prompts/{persona_id}.md`, version-controlled.
- 10% moderation sample on Gemini's outgoing text via OpenAI Moderation API; flagged content gets logged + the agent gets a redacted system message.

### 8.3 Personas (Phase 1: one per merchant, set at provision time)

| ID             | Voice                    | Vibe                                 |
| -------------- | ------------------------ | ------------------------------------ |
| `concierge`    | Warm female, mid-tone    | Premium retail, jewelry, hospitality |
| `enthusiast`   | Energetic female, upbeat | Beauty, fitness, lifestyle           |
| `expert`       | Calm male, knowledgeable | Electronics, tools, B2B              |
| `friend`       | Casual female, warm      | Apparel, home, gifts                 |
| `professional` | Formal male, mid-tone    | Services, financial, legal-adjacent  |
| `playful`      | Bright female, fun       | Kids, toys, novelty                  |
| `wise`         | Older male, measured     | Wellness, supplements, traditional   |
| `crisp`        | Neutral, fast            | Utility, B2B, no-frills              |

System prompts live in `config/persona-prompts/{persona_id}.md`, version-controlled, loaded at session start.

### 8.4 Model routing

| Task                          | Model                         | Why                                                                                              |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Voice STT + TTS (native audio) | gemini-2.5-flash-live         | One round trip; lowest latency; lowest $/voice-min — see ADR-0001                                |
| Agent tool-call loop (text + tool-using voice turns) | claude-sonnet-4-6 | Best tool-use accuracy                                                                           |
| Default text-turn routing     | claude-haiku-4-5              | 70% of text turns are simple (greet, recommend, KB lookup). Margin invariant — strategy §5.4     |
| Selector resolution (runtime) | claude-haiku-4-5              | Cheap, fast, vision-capable                                                                      |
| Onboarding extraction         | claude-sonnet-4-6             | One-time per merchant; vision required for selector grounding                                    |
| Moderation sampling           | OpenAI Moderation API         | Free, fast                                                                                       |

**Routing rule:** Sonnet only fires on turns that need a tool call. The dispatcher inspects the visitor message; if it can be answered by Haiku (no cart/checkout/coupon verbs and no KB lookup beyond the in-prompt chunks), it routes to Haiku. This is the engineering invariant that holds the margin floor.

### 8.5 Voice discipline (pricing & money)

v0.1 targets D2C merchants only — static catalog pricing is a safe assumption. The price source-of-truth hierarchy is:

1. **Merchant's live page** (visitor's eyes) — ultimate truth.
2. **`products.price_cents`** in our DB — used by `ui.show_card` to render the price typed-and-exact inside the widget bubble. Mirror of (1) under the D2C assumption; merchant can correct via the P2 dashboard.
3. **The voice agent never speaks numeric prices.** Always paraphrases:
   - ✅ "around twelve hundred", "a little under two thousand", "your cart total on screen is about ₹X"
   - ❌ "this shirt is one thousand two hundred and thirty four rupees"

System-prompt clause shipped in every persona prompt:

> _"You are speaking to a visitor who can see the merchant's website. Never state, read out, or compose a numeric price in voice. When discussing money, paraphrase ranges or refer the visitor to what's on screen. Exact prices are shown to the visitor through cards in the widget — they do not need to hear them. Coupon savings can be paraphrased the same way."_

A lightweight post-LLM guard (regex against currency-with-digits patterns in TTS-bound text) flags violations to telemetry and replaces the offending number with "the price on screen" before TTS synthesis. Goal is detection + correction, not blocking — measured against acceptance criterion #11 (§14).

---

## 9. Payment handoff

shoppingmate.ai **never** touches payment. When the visitor taps "Pay" in the widget:

```
1. LLM emits checkout.handoff tool call
2. Backend resolves checkout URL via adapter:
     - Shopify:    https://{domain}/cart  (Shopify checkout)
     - Woo:        https://{domain}/checkout
     - Magento:    https://{domain}/checkout
     - BigCommerce: https://{domain}/checkout.php?action=load_checkout&...
     - Wix:        https://{domain}/cart-page
     - Squarespace: https://{domain}/checkout
     - DOM:        merchants.checkout_url (extracted at onboarding)
3. ws.send({ type:'checkout.handoff', mode:'redirect', url: checkoutUrl })
4. gtag does window.location.assign(url)
```

In Phase 1, `mode` is always `redirect`. Phase 2 may add `payment_link` and `qr` modes.

---

## 10. Conversion attribution

```
After redirect → visitor completes purchase on merchant's native checkout
              → merchant's thank-you page loads
              → gtag (still injected on every page) detects URL pattern
                  /thank_you, /thank-you, /order-received, /order/, /checkout/order/
              → gtag scrapes order ID + total from page using merchant.adapter_config.thank_you_selectors
              → gtag POST /v1/conversion {
                  merchantId, sessionId, orderId, total_cents, currency, ts
                }
              → backend writes conversion_events row
              → backend updates billing_ledger.conversion_value_cents
```

If the merchant has Shopify webhooks (Phase 2), we'll switch to those for ground truth. In Phase 1, gtag detection is the source.

---

## 11. Storage

### 11.1 Postgres (durable)

```sql
merchants (
  id              text PRIMARY KEY,         -- e.g. 'SM-AB12CD'
  domain          text NOT NULL UNIQUE,
  platform        text,                     -- 'shopify' | 'woo' | ... | 'unknown'
  platform_confidence numeric,
  status          text NOT NULL,            -- 'onboarding' | 'live' | 'degraded' | 'suspended'
  adapter_type    text NOT NULL,            -- 'shopify' | ... | 'dom' | 'suggest'
  adapter_config  jsonb NOT NULL,           -- selectors, API tokens, page-template hashes
  cart_url_template text,
  checkout_url    text,
  coupon_field_selector text,
  policy_urls     jsonb,
  persona_id      text DEFAULT 'concierge',
  installed_at    timestamptz NOT NULL,
  last_indexed_at timestamptz
);

products (
  merchant_id     text REFERENCES merchants(id),
  sku             text NOT NULL,
  title           text NOT NULL,
  description     text,
  image_url       text,
  product_url     text NOT NULL,
  variants        jsonb,                    -- [{ id, options:{size,color}, price_cents, in_stock }]
  price_cents     integer,
  currency        text,
  in_stock        boolean,
  indexed_at      timestamptz,
  source          text,                     -- 'platform_api' | 'crawl' | 'manual'
  PRIMARY KEY (merchant_id, sku)
);

selector_cache (
  merchant_id        text REFERENCES merchants(id),
  page_template_hash text NOT NULL,
  selector_key       text NOT NULL,         -- 'add_to_cart_button' | ...
  resolved_selector  text NOT NULL,
  source             text NOT NULL,         -- 'auto' | 'llm_resolved' | 'merchant_override'
  override_locked_at timestamptz,           -- when merchant set the override (null for non-overrides)
  last_tested_at     timestamptz,
  last_test_passed   boolean,
  suggested_replacement text,               -- LLM's suggestion when override is failing (Phase 2 alerting)
  alert_sent_at      timestamptz,
  PRIMARY KEY (merchant_id, page_template_hash, selector_key)
);

brand_kb_chunks (
  id           bigserial PRIMARY KEY,
  merchant_id  text REFERENCES merchants(id),
  source_doc   text,                        -- e.g. 'returns-policy.pdf'
  chunk_index  integer NOT NULL,
  content      text NOT NULL,               -- 500-1500 char chunk
  embedding    vector(1536),                -- pgvector; populated by ingestion job in Phase 2
  ingested_at  timestamptz NOT NULL,
  UNIQUE (merchant_id, source_doc, chunk_index)
);

conversion_events (
  id           bigserial PRIMARY KEY,
  merchant_id  text REFERENCES merchants(id),
  session_id   text NOT NULL,
  order_id     text,
  total_cents  integer,
  currency     text,
  ts           timestamptz NOT NULL
);

billing_ledger (
  merchant_id            text REFERENCES merchants(id),
  period                 date NOT NULL,     -- first day of month
  conversations_count    integer DEFAULT 0,
  voice_minutes          numeric DEFAULT 0,
  conversion_value_cents bigint DEFAULT 0,
  llm_cost_usd           numeric DEFAULT 0,
  stt_cost_usd           numeric DEFAULT 0,
  tts_cost_usd           numeric DEFAULT 0,
  PRIMARY KEY (merchant_id, period)
);
```

### 11.2 Redis (24h TTL)

- `session:{sessionId}` → JSON: { merchantId, history, cartToken, persona, lastTurnAt }
- `cart:{sessionId}` → opaque adapter cart state (where adapter doesn't manage it)

> **Removed:** `quote:{sessionQuoteId}`. The earlier idea of freezing a price for the duration of a turn is unnecessary under v0.1's D2C-static-pricing assumption. The merchant's page is the price source of truth; the visitor sees the live price on screen and at checkout. See §8.5 and roadmap §6 (`❌ Quote-freeze / verify-before-commit`).

### 11.3 S3 / R2 (7d TTL)

- `screenshots/{merchantId}/{ts}.png` — onboarding + selector failure snapshots
- `transcripts/{sessionId}.json` — full session transcript (deleted after 7d unless flagged for review)
- `audio/{sessionId}/{turnId}.opus` — recorded TTS audio (used for QA sampling)

### 11.4 Per-node LRU

- Onboarded merchant configs (1-min TTL after WebSocket disconnect)
- Compiled persona prompts
- Adapter clients (HTTP keep-alive)

---

## 12. Security & privacy

- gtag never sees payment data — pages with `[type="password"]` or card-input fields are explicitly off-limits to the executor.
- Conversation transcripts auto-expire at 24h (Redis) / 7d (S3).
- No cross-merchant data sharing — every query filters by `merchant_id`.
- All inter-service traffic is mTLS.
- gtag bundle is served from a CDN with SRI hash verification (merchants can pin a version: `data-version="1.0.4"`).
- Outgoing TTS text is moderation-sampled (10%); flagged content gets logged + the agent gets a redacted system message.

---

## 13. Cost, rate limits, & performance budget (Phase 1 hardcoded)

### 13.1 Runtime caps (per conversation — margin guarantee)

These are the §5.4 margin-floor mechanism. They are **non-negotiable**; any plan that drops or relaxes them is rejected (see roadmap §6 guardrails).

- **15 turns per visitor conversation** (was 10; tightened 2026-05-01)
- **3 min voice per conversation** (was unbounded; tightened 2026-05-01)
- **25 min total duration per conversation** (was 60; tightened 2026-05-01)
- 30 tool-calls per LLM turn
- 5 LLM selector resolutions per session
- 50 DOM actions per turn, 200 per session
- 100 visitor sessions per merchant per hour (DDoS guard)
- 1 onboarding job per merchant (idempotent)
- **$0.15 per-conversation hard cost-cut** (terminate beyond — was $0.50; tightened 2026-05-01 to enforce worst-case GM ≥ 70%)
- No-reply sessions and bot traffic don't count against the merchant's billed conversations.

These are baked in for v0.1; Phase 3 makes them per-merchant configurable.

### 13.2 Widget performance budget (gtag)

The merchant's site speed is part of the product. These are CI-enforced and PR-blocking:

| Metric                                     | Budget                              | How enforced                                                  |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------- |
| `cdn.shoppingmate.ai/v1.js` size, gzipped  | ≤120KB (target ≤80KB by v0.2)       | CI: `bundle-size` check fails if `dist/v1.js.gz > 120000` B    |
| First-load LCP impact (vs. baseline)       | 0ms                                 | Lighthouse CI on staging fixture page (Shopify + custom HTML) |
| First-load CLS impact                      | 0                                   | Same                                                          |
| First-load INP impact (post-mount)         | ≤50ms                               | Same                                                          |
| First-load Time-to-Interactive delay       | ≤30ms                               | Same                                                          |
| Memory (bubble unopened)                   | ≤2MB                                | Manual chrome devtools profiling per release                  |
| Memory (engaged session, mid-conversation) | ≤8MB                                | Same                                                          |
| Lighthouse Performance score impact        | ≤2 points                           | Lighthouse CI                                                 |

### 13.3 Disciplines that make 13.2 achievable

These are non-negotiable build constraints for the gtag bundle:

1. **`async` script tag only** — `<script async>`. Never `defer`, never blocking.
2. **`requestIdleCallback` for mount** — bubble UI doesn't render until browser idle (≥200ms after LCP).
3. **Both WebSockets deferred to engagement** — agent-WS opens only when visitor clicks the bubble; voice-WS opens only on first mic tap. Visitors who never engage pay only the initial fetch cost.
4. **No third-party SDKs in the bundle** — no Sentry browser SDK, no Mixpanel, no GA. Telemetry rides our own WebSocket.
5. **Shadow DOM closed mode** — zero CSS leakage either direction. No layout reflow on merchant CSS changes.
6. **System font stack** — no web-font fetches.
7. **Lazy-load product card images** — `loading="lazy"`, 200px thumbnails, never full-resolution in-bubble.
8. **Single CSS file inlined into Shadow root** — no extra network request for styles.

### 13.4 What this means for the bundle build

- Build tool: Vite + esbuild (Plan 8). Source map shipped to CDN at a separate URL (`v1.js.map`) for our debugging only — not eagerly fetched by browsers.
- Brotli + gzip both pre-compressed; CDN serves whichever the visitor accepts (Brotli typically 15-20% smaller than gzip).
- Treeshaking + esbuild minify with `legalComments: 'none'`, `mangleQuoted: true`.
- A `SIZE_BUDGET.md` in the repo records each release's compressed size; CI fails the PR if it exceeds the budget.

---

## 14. Acceptance criteria

Phase 1 is done when **all** of the following pass on the staging environment:

1. **Shopify happy path:** Paste gtag on a dev Shopify store with 50+ products. Within 8 min, status='live'. Visitor opens widget, says "I want a blue shirt size M," widget adds it via Storefront API, redirects to Shopify checkout, visitor completes purchase, conversion event lands in Postgres within 60s of order completion.
2. **Woo happy path:** Same, but on a dev WooCommerce store.
3. **Custom site happy path:** Same, but on a hand-built static-HTML + JS shop with no recognized platform. Onboarding correctly identifies it as `dom`, extracts selectors, and the cart-add succeeds via DOM driving.
4. **Selector self-heal:** Manually break the `add_to_cart` selector on the custom site (rename the class). Within the first failed visitor turn, Haiku resolves a working selector and the cart-add succeeds on retry. The new selector is cached.
5. **Suggest fallback:** On a third site where DOM control is intentionally blocked (Shadow-DOM cart widget), the agent degrades to suggest mode within one turn and visibly tells the visitor to tap the button themselves.
6. **Voice end-to-end:** All three happy paths (1, 2, 3) work via voice-only input — STT transcripts arrive, LLM responds, TTS plays back in the chosen persona's voice.
7. **All 8 personas:** Each persona produces audibly distinct, on-brand greetings on a test page.
8. **Privacy guard:** Test page with a `[type="password"]` field — selector resolver refuses to return it; DOM executor blocks any click instruction targeting it.
9. **Cost ceiling + margin gate:** Single conversation cannot exceed $0.15 in measured COGS (LLM voice + text + selector + onboarding amortized) before being terminated. Across the closed-beta cohort, measured worst-case GM per plan ≥ 70% including the voice-fairness surcharge — see strategy §5.4. If the gate fails, hold the public launch.
10. **Idempotency:** Re-running the same install (gtag loads twice, OnboardingJob enqueued twice) does not double-write merchant rows or duplicate products.
11. **Voice pricing discipline (§8.5):** Across all three happy paths (1, 2, 3), full TTS-bound transcripts contain **zero** numeric currency mentions (verified by regex scan over the recorded session). Cards in the widget show exact prices typed from `products.price_cents`. The post-LLM guard's correction count is logged and ≤2% of turns trigger it.
12. **DOMAdapter multi-selector fallback:** For the custom-site happy path (3), `adapter_config` for at least one verb (e.g. `cart.add`) contains ≥2 candidate selectors. When the primary selector is removed, the runtime tries the alternate **before** invoking the Haiku resolver — verified in logs.

---

## 15. Open questions

None. All previously open questions resolved during the 2026-04-25 → 2026-04-30 brainstorm sessions:

- ~~Shopify App Store vs gtag~~ → gtag-only in Phase 1
- ~~Voice from day 1?~~ → yes, in Phase 1
- ~~Selector signing / quote tokens~~ → not needed (we don't orchestrate payment)
- ~~How does DOM control work on custom sites~~ → DOMAdapter + multi-selector fallback chains in `adapter_config` + runtime Haiku resolver + suggest fallback
- ~~What if merchant overrides break~~ → Phase 2 problem; Phase 1 has no override-creation surface (but the runtime already honours `selector_cache.source='merchant_override'`)
- ~~Voice agent quoting wrong prices / hallucination~~ → **dissolved by D2C-static-pricing assumption + voice-never-quotes-numbers rule (§8.5)**. No quote-freeze infrastructure needed.
- ~~Brand KB retrieval mode (RAG vs naïve concat)~~ → Phase 2 decision: naïve concat for KBs ≤ 8K tokens; embedding-based top-K (k=6) fallback only when budget exceeded.
- ~~Coupon discovery + suggestion verbs~~ → Phase 2: `coupons.list` and `coupons.suggest(cart)` added then. Phase 1 keeps only `coupons.try`.
- ~~Take-rate vs SaaS billing~~ → **dropped take-rate permanently**. SaaS-only via Stripe Billing in Phase 3. shoppingmate.ai is not a payment processor; merchants keep their existing checkout/payouts unchanged. No Razorpay Routes, no Stripe Connect, no per-conversion revenue share. See roadmap §6 guardrails.
- ~~Should override be a primary dashboard surface or a safety valve~~ → **safety valve only**. Phase 1 must hit reliability targets (≥99.5% on platform adapters, ≥95% on DOMAdapter — see roadmap §7) so that override is an alert-driven, rare path. The runtime contract (`selector_cache.source='merchant_override'` is locked + immune to auto-heal) is already enforced from Phase 1; only the editor UI is Phase 2.

---

## 16. Reliability requirements (anchors roadmap §7 in Phase 1 code)

Phase 1 must instrument the metrics roadmap §7 sets numeric targets for. These are not optional; Phase 1 ships the data plane that Phase 2's dashboard reads.

### 16.1 Metrics emitted from Phase 1 code

| Metric                                                       | Where emitted                                                                            | Stored as                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `selector.first_try.success` / `selector.first_try.fail`     | DOMAdapter + every platform adapter, on every cart/checkout verb                         | Postgres `metric_events` (counter, tagged with `merchant_id`, `adapter_type`, `selector_key`) |
| `selector.heal.attempted` / `selector.heal.succeeded`        | Runtime selector resolver (§7.4) when transitioning `auto`→`llm_resolved`                | Same table                                                                 |
| `selector.override.skipped` / `selector.override.alerted`    | Runtime selector resolver when `source='merchant_override'` row fails                    | Same table; override_alerts row written (Phase 2 reads to populate banner) |
| `tool.call.duration_ms` per tool                             | LLM loop dispatcher                                                                      | Same table (histogram)                                                     |
| `voice.numeric_price_corrected`                              | Post-LLM TTS guard (§8.5)                                                                | Same table (counter, per session)                                          |

### 16.2 The `metric_events` table (new in Phase 1)

```sql
metric_events (
  id           bigserial PRIMARY KEY,
  merchant_id  text REFERENCES merchants(id),
  metric_name  text NOT NULL,
  value        numeric NOT NULL DEFAULT 1,
  tags         jsonb,                       -- { adapter_type, selector_key, session_id, ... }
  ts           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON metric_events (merchant_id, metric_name, ts DESC);
```

In Phase 1 we just emit + store. Phase 2's dashboard runs the aggregations (e.g. "what % of `selector.first_try.success` over last 7d for `merchant_id=X` and `adapter_type='dom'`?") and surfaces them as tiles.

### 16.3 Phase 1 acceptance for reliability instrumentation

- For every successful adapter call in the §14 acceptance criteria, the corresponding `metric_events` row exists.
- The override-handling code path (§7.4 "source='merchant_override' → DO NOT auto-heal") emits both `selector.override.skipped` and writes an `override_alerts` row even though no merchant action will be taken in Phase 1 (Phase 2 alerter consumes the row).
- All metric writes are async (`fire-and-forget` queue → BullMQ batch insert every 5s) — they must not add latency to the visitor-facing tool-call path.

---

## 17. Out of scope (explicit non-goals for Phase 1, restated for clarity)

To keep this spec aligned with roadmap §6 guardrails:

- ❌ No Stripe Connect / Razorpay Routes / take-rate code anywhere in Phase 1. Cost ledger writes happen (so Phase 3 has data to bill from), but no payment-processor SDK is integrated.
- ❌ No inline payment capture in the widget. `checkout.handoff` is always a redirect.
- ❌ No "Recipe-Card editor" or override-creation UI. The runtime honours overrides if any exist, but the only way to create one in Phase 1 is a direct DB write (manual support flow).
- ❌ No primary dashboard build. Cost-ledger reads, override alerts, and metric_events tables are populated and queryable, but there is no Next.js app yet — it ships in Phase 2.
- ❌ No multi-tier billing / overage logic. Stripe Billing integration is entirely Phase 3.
