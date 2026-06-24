# shoppingmate Demo Video — Production Script

**Mode:** 100% UI-only. Sage chatting on top of a **live, fully-styled e-commerce storefront** that visually reacts to every answer. No backgrounds, no device frames, no cinematic plates.

**What viewers see:** a real-looking Nike-style product page where a buyer asks four realistic questions — *memory foam? delivery to Bangalore? any discounts? add to cart?* — and watches Sage answer + the storefront update in sync.

**Brand rules:** zero "agent" language. Zero Slack on customer-facing surfaces. Sage never voices numeric prices.

> ⚠️ **Legal note on real brand names:** the storefront aesthetic is Nike-shaped (matte-black running shoe, swoosh-adjacent stripe, sportswear typography). To avoid trademark exposure on a public landing page, the on-screen brand name is the **fictional "Pacelab"**. The visual look + conversational realism do all the credibility work; the literal "Nike" wordmark is unnecessary risk. Easy swap if Nike or another real brand grants explicit permission later.

---

## Pipeline

| Step | Tool | Output |
|---|---|---|
| 1. Live storefront templates | Next.js routes under `web/src/app/_demo/` styled like real e-comm | Fully-functional product pages |
| 2. Headless UI capture | Puppeteer + Chrome screencast | Per-beat MP4 segments |
| 3. Voice | **fal.ai TTS** (ElevenLabs / PlayAI / MiniMax) | Sage VO + narrator WAVs |
| 4. SFX | Procedural Web Audio offline render | Stamp, chime, keystroke, click WAVs |
| 5. Compose | ffmpeg | Per-cut MP4 |
| 6. Captions | ffmpeg `subtitles=` (burned) + `.vtt` sidecar | Accessibility |
| 7. Upload | ffmpeg + AWS S3 SDK to R2 | Final assets |

**Spend:** ~$3 (TTS only). **Wall-clock:** ~30 min.

---

## The chat UI (the star of every cut)

A floating Sage chat panel anchored to the right side of every storefront. Same five primitives across all cuts:

1. **Voice-input visualization** — mic pill with pulsing rose ring; 32-bar waveform with deterministic amplitude curves; live transcript characters streaming at ~50ms/char; on commit, transcript locks and swooshes up as a user bubble.
2. **Text-input** — bottom text field, blinking cursor, ~60ms/char keystroke animation, send swoosh.
3. **Sage typing indicator → bubble reveal** — 3-dot pulse 0.4s → bubble springs in (mass 0.5, damping 12, stiffness 180) → text streams at ~30ms/char.
4. **Storefront-side reactions** — sections of the product page get a soft violet highlight border when Sage references them; specific values (delivery date, discount line, cart count) update inline.
5. **Cart drawer** — slides in from the right as an overlay over the chat panel when items are added.

---

## Phase 0 — Live working storefront templates

Each `_demo` route is **a complete e-comm product page**, not a stub. Top nav, breadcrumbs, product gallery, color/size pickers, full spec sheet with collapsible sections, reviews section, sticky add-to-cart, cart drawer. Indistinguishable from a real Shopify/Woo/Magento storefront at first glance.

The chat panel is the only "extra" overlay. When Sage answers a question, the relevant storefront section visibly highlights — making it feel like Sage is **driving** the storefront, not just describing it.

| Route | Product | Brand (fictional) | Aesthetic | Used in |
|---|---|---|---|---|
| `_demo/pacelab/aero-run-4` | Running shoe — ₹8,999 | **Pacelab** | Nike-style sportswear | Cut 1 |
| `_demo/lumiere/linen-jacket` | Linen jacket — ₹4,499 | **Lumière** | Zara/COS-style fashion | Cut 3a |
| `_demo/hexa/podcast-mic-bundle` | Mic comparison — ₹14,999 | **Hexa** | Apple-style electronics | Cut 3b |
| `_demo/stride/sneaker-shop` | Sneaker results page | **Stride** | Decathlon/AJIO-style mass | Cut 3c |
| `_demo/lumiere/plus-activewear` | Plus-size leggings | **Lumière** | Inclusive activewear | Cut 3d |
| `_demo/howto` | Code editor + storefront morph | — | Split screen | Cut 2 |
| `_demo/title` | Title-card renderer | — | Type cards | All |

Each route exposes `?capture=<beatId>` driving a deterministic state machine + `window.__captureReady` flag for Puppeteer.

---

# Cut 1 — Sage closes a Nike-style sneaker sale (30s)

**Goal:** in 30s, watch a real-feeling buyer interrogate a Nike-style running shoe across four dimensions — *spec, logistics, promotion, action* — and Sage close the cart.

**Storefront:** `_demo/pacelab/aero-run-4` — looks like nike.com / Pacelab Aero Run 4. Top nav with cart icon (badge: 0). Breadcrumb "Men > Running > Aero Run 4". Product gallery on the left (4 angles of a matte-black runner with rose accents). Title block on the right: "Pacelab Aero Run 4", price ₹8,999, ★★★★☆ (1,247 reviews). Color picker (Black/White, Black/Rose, Triple White). Size picker (UK 6, 7, 8, 9, 10, 11). Sticky "Add to Cart". Below: collapsible spec sheet with **Cushioning**, **Materials**, **Delivery**, **Reviews** sections. Sage chat panel docked right.

### 0:00–0:02 — Title card
- **Visual:** dark bg, `shoppingmate` wordmark fades in. Sub: *"a buyer asks. Sage answers. The cart fills itself."*
- **Audio:** soft synth pad
- **Source:** `_demo/title?style=intro&text=a-buyer-asks` → 60 frames

### 0:02–0:05 — Storefront arrives
- **Visual:** Pacelab product page fades in fully populated. Cart icon shows "0". Sage chat panel slides in from right with mic pill idle.
- **Audio:** soft swoosh
- **Source:** `_demo/pacelab/aero-run-4?capture=intro` → 3s

### 0:05–0:10 — Q1: "is this shoe having memory foam?" (voice)
- **Visual:**
  - Mic pill blooms rose, waveform dances through 4 amplitude peaks
  - Live transcript types: *"is this shoe having memory foam?"*
  - On commit, transcript swooshes up as user bubble
  - Sage typing indicator → bubble: *"Yes — dual-density memory foam in the midsole. Great for daily 10K runs and standing all day."*
  - **Storefront reaction:** the **Cushioning** section in the spec sheet auto-expands and highlights with a soft violet border. Text inside reads "Dual-density memory foam midsole · ZoomFlex heel pod · 12mm drop".
- **Audio:** listening chime + **Sage VO line 1**
- **Caption:** "Dual-density memory foam in the midsole. Great for daily 10K runs."
- **Source:** `_demo/pacelab/aero-run-4?capture=q1-memory-foam` → 5s

### 0:10–0:15 — Q2: "when can it be delivered to Bangalore?" (voice)
- **Visual:**
  - Waveform dances again, transcript types: *"when can it be delivered to Bangalore?"*
  - Sage bubble: *"Standard delivery to 560001 is Tuesday. Express tomorrow by 9 PM."*
  - **Storefront reaction:** the **Delivery** section auto-expands and highlights. Inline content updates from generic placeholder to:
    > Pin: **560001** (Bangalore — auto-detected from query)
    > **Standard:** Tue, 12 Aug · Free
    > **Express:** Tomorrow by 9 PM · +₹150
  - A small "Pin verified" check icon appears next to the pin code
- **Audio:** **Sage VO line 2**
- **Caption:** "Standard to 560001 is Tuesday. Express tomorrow."
- **Source:** `_demo/pacelab/aero-run-4?capture=q2-delivery` → 5s

### 0:15–0:20 — Q3: "any discounts?" (text)
- **Visual:**
  - Buyer focuses the text field, types: *"any discounts?"* at ~60ms/char
  - Send swoosh
  - Sage bubble: *"Yes — code FIRSTRUN gives you 12% off on your first order. Applied."*
  - **Storefront reaction:** SVG `FIRSTRUN` stamp lands over the price line with -2°→0° spring shake
  - Price line transitions: ₹8,999 (strikethrough) → **₹7,919** with "−₹1,080 (FIRSTRUN)" subtitle in green
- **Audio:** keystrokes × 14 + send swoosh + **Sage VO line 3** + stamp thunk
- **Caption:** "FIRSTRUN — 12% off your first order, applied."
- **Source:** `_demo/pacelab/aero-run-4?capture=q3-discount` → 5s

### 0:20–0:25 — Q4: "add to cart" (voice)
- **Visual:**
  - Mic pill blooms, waveform short burst, transcript: *"please add to cart"*
  - Before Sage answers, Sage cursor (small dot) glides on the storefront — clicks **size UK 9** chip (chip selects with click ripple), then clicks **Add to Cart** button
  - Cart icon in top nav ticks 0 → 1 with a soft bounce
  - Sage bubble: *"Done. Aero Run 4 in size 9, your express delivery, ₹7,919 with FIRSTRUN."*
  - Cart drawer slides in from the right (overlays chat panel) showing the line item with thumbnail, size, color, price, and a "Checkout" button
- **Audio:** click SFX × 2 + cart bounce SFX + **Sage VO line 4**
- **Caption:** "Done. Size 9, express delivery, FIRSTRUN applied."
- **Source:** `_demo/pacelab/aero-run-4?capture=q4-add-to-cart` → 5s

### 0:25–0:30 — Outro
- **Visual:** dark bg returns. `shoppingmate` wordmark + URL `shoppingmate.ai` + line "Your storefront just learned to talk. And to sell."
- **Audio:** closing synth tail
- **Source:** `_demo/title?style=outro&text=storefront-talks`

---

# Cut 2 — How it works (30s, fully animated)

**Goal:** prove one-line install + cross-platform support. AI narrator voice; no human on camera.

**Container:** split-screen. Monaco-style code editor on left (60%) + storefront preview on right (40%).

### 0:00–0:03 — Hook
- **Visual:** dark bg. Big text fades in: *"Thirty seconds. One line of code."*
- **Audio:** **Narrator VO:** *"Thirty seconds. One line of code."*

### 0:03–0:14 — Code editor types the line
- **Visual:** editor opens with `theme.liquid`-shaped HTML scrolled to `</body>`. Cursor positions, types in at ~50ms/char:
  ```html
  <script src="https://cdn.shoppingmate.ai/v1/sm.js" data-shop="your-shop" defer></script>
  ```
  Save toast: "✓ Saved".
- **Audio:** **Narrator VO:** *"Paste one line into your theme. No app store review. No SDK in your bundle."* + keystroke bed
- **Source:** `_demo/howto?capture=editor`

### 0:14–0:20 — Storefront wakes up
- **Visual:** right pane storefront refreshes with shimmer, Sage chat panel slides in, mic pill pulses once, first Sage bubble: *"Hi! I'm Sage. Ask me anything about this store."*
- **Audio:** **Narrator VO:** *"Refresh. Sage is live."* + brief Sage VO: *"Hi! I'm Sage."*
- **Source:** `_demo/howto?capture=wake`

### 0:20–0:25 — Cross-platform morph
- **Visual:** storefront skin morphs through 5 platform shapes — Shopify → Woo → Magento → Wix → Squarespace — each ~1s with platform name chip beneath. Sage chat persists unchanged across all morphs.
- **Audio:** **Narrator VO:** *"Shopify, Woo, Magento, Wix, Squarespace, custom. Most competitors are Shopify-only. Not us."*
- **Source:** `_demo/howto?capture=platforms`

### 0:25–0:30 — Close
- **Visual:** dark bg. Three lines fade in stagger: *"Thirty dollars a month."* / *"Seventy percent gross margin."* / *"shoppingmate.ai — try the live demo."*
- **Audio:** **Narrator VO:** *"Thirty dollars a month. Seventy percent margin. shoppingmate.ai — your trial is the live demo on the page."*

---

# Cut 3 — Four buyers, four real conversations (20s)

**Goal:** show the chat handling four distinct intents on four different real-feeling storefronts. Same chat primitives, different content.

### 0:00–0:05 — Fashion (sizing on a Zara-style brand)
- **Storefront:** Lumière linen jacket page. Title, price ₹4,499, color/size pickers, fit guide collapsible.
- **Q (text):** *"will the M run small for slim fit?"*
- **A (Sage):** *"Lumière runs slim. You're a small in their fit — go XS in this jacket."*
- **Storefront reaction:** Fit Guide section highlights, "XS" chip pulses, "M" chip dims with strikethrough.
- **Caption:** "Fashion · sizing"

### 0:05–0:10 — Gadgets (comparison on an Apple-style brand)
- **Storefront:** Hexa podcast mic comparison page. Two mics side-by-side with spec tables.
- **Q (voice):** *"which one's better for voiceover?"*
- **A (Sage):** *"The dynamic mic on the right rejects room noise better — better for untreated rooms."*
- **Storefront reaction:** right-side mic spec table highlights, "Noise Rejection: −18 dB" row pulses violet.
- **Caption:** "Gadgets · compare"

### 0:10–0:15 — Voice (hands-busy on a mass-market brand)
- **Storefront:** Stride sneaker results page (4 sneakers in a grid, filters bar).
- **Q (voice, long):** *"running shoes under five thousand with cushion"*
- **A (Sage):** *"Three under five thousand with proper cushion: Pacelab Aero Lite, Stride Glide, Velocity 3."*
- **Storefront reaction:** filters bar updates to show "Under ₹5,000" + "Cushioned" pills active. Three matching shoe cards highlight; rest fade.
- **Caption:** "Voice · hands-busy"

### 0:15–0:20 — Inclusive (Hindi on a sportswear brand)
- **Storefront:** Lumière plus-size activewear PDP.
- **Q (voice, Devanagari transcript):** *"क्या यह मेरे साइज़ XL में है?"*
- **A (Sage, Hindi):** *"Haan, XL stock mein hai. Add karoon?"*
- **Storefront reaction:** size picker highlights "XL" chip with green check + "In stock" badge.
- **Note:** if fal.ai Hindi TTS is robotic, fall back to Spanish: *"Sí, XL disponible. ¿Te lo agrego?"* — same beat structure.
- **Caption (English):** "Inclusive · Hindi"

### Closing tag (overlaid on final frame, 0.5s before fade)
- **Text:** "One line of code. Every kind of buyer."

---

# Cut 4 — Bumper (6s, paid retargeting)

**Goal:** under-6s recognition for Meta / TikTok ads. 1:1 + 9:16 only.

### 0:00 — wordmark
- **Visual:** `shoppingmate` wordmark, dark bg

### 0:01–0:02 — line types in
- **Visual:** "Your storefront just learned to talk."

### 0:02–0:04 — Sage chat flash on Pacelab page
- **Visual:** the Pacelab storefront flashes in. User bubble: *"any discounts?"*. Sage bubble: *"FIRSTRUN — 12% off, applied."*. Stamp lands. Cart count ticks 0 → 1.
- **Audio:** brief Sage VO: *"FIRSTRUN — 12% off, applied."*

### 0:04–0:05 — line 2
- **Visual:** "And to sell."

### 0:05–0:06 — outro
- **Visual:** `shoppingmate.ai — install in under 60s`
- **Audio:** closing tone

**Source:** trimmed from Cut 1's `_demo/pacelab/aero-run-4?capture=q3-discount` segment + title overlays.

---

# Hero loop (4–6s, no audio, autoplay-muted)

**Goal:** the chat UI in motion on the Pacelab storefront — embedded in the hero card on shoppingmate.ai. Loops forever.

**Format:** MP4 + WebM, ≤1.5 MB combined, 16:10.

**Source:** headless render of the live `web/src/components/Hero.tsx` microinteractions (Plan Tasks 4–9). Same animation as live JS, frame-for-frame.

### 0:00–0:01 — Pacelab page idle
### 0:01–0:02 — Voice waveform fires: *"any discounts?"*
### 0:02–0:03 — Sage answers: *"FIRSTRUN — 12% off, applied."*
### 0:03–0:05 — Stamp lands, price strikes through, cart count ticks
### 0:05–0:06 — Reset

---

# Master task list

## Phase 0 — Live storefront templates (one-time)
- [ ] **0.1** Build `<ChatPanel />` component with mic pill + waveform + transcript + bubbles + typing indicator. Voice and text modes share one surface.
- [ ] **0.2** Build `<StorefrontShell />` — top nav with logo + cart icon, breadcrumb, footer. Parameterized by brand prop.
- [ ] **0.3** Build `<ProductPage />` — gallery, title, price, reviews summary, color picker, size picker, sticky CTA, collapsible spec sections, cart drawer overlay.
- [ ] **0.4** Build `<PriceLine />` with strikethrough/discount transition.
- [ ] **0.5** Build `<CouponStamp />` SVG with -2°→0° spring entry.
- [ ] **0.6** Build `<DeliveryBlock />` that updates from placeholder to specific pin/date inline.
- [ ] **0.7** Build `<CartDrawer />` slide-in overlay.
- [ ] **0.8** Wire `_demo/pacelab/aero-run-4` with `?capture=intro|q1-memory-foam|q2-delivery|q3-discount|q4-add-to-cart` deterministic state machines.
- [ ] **0.9** Wire `_demo/lumiere/linen-jacket?capture=cut3a`, `_demo/hexa/podcast-mic-bundle?capture=cut3b`, `_demo/stride/sneaker-shop?capture=cut3c`, `_demo/lumiere/plus-activewear?capture=cut3d`.
- [ ] **0.10** Wire `_demo/howto?capture=editor|wake|platforms|close` (split-screen + 5 platform skins).
- [ ] **0.11** Wire `_demo/title?style=intro|outro|hook|close-pricing&text=...`
- [ ] **0.12** Each route exposes `window.__captureReady`.

## Phase 1 — Asset generation scripts
- [ ] **1.1** `apps/api/scripts/video-gen/fal-tts.ts` — generate 11 Sage lines + 4 narrator lines. Output WAV + duration metadata.
- [ ] **1.2** `apps/api/scripts/video-gen/capture-ui.ts` — Puppeteer harness against `web/` dev server, drives each `?capture=` route, screencast → MP4.
- [ ] **1.3** `apps/api/scripts/video-gen/sfx-gen.ts` — synthesize SFX (stamp, keystroke, click, swoosh, chime, listening cue, closing tone) via offline Web Audio.
- [ ] **1.4** `apps/api/scripts/video-gen/timelines/{cut1,cut2,cut3,cut4,hero-loop}.json` — per-cut declarative timelines.
- [ ] **1.5** `apps/api/scripts/video-gen/compose.ts` — ffmpeg filter graph builder per timeline.
- [ ] **1.6** `apps/api/scripts/video-gen/upload.ts` — R2 upload via S3 SDK.
- [ ] **1.7** `apps/api/scripts/video-gen/run-all.ts` — orchestrator. Boots web server, runs TTS + SFX in parallel, then capture, then compose per cut, then upload, then auto-commits URL constants to `web/src/lib/demo-assets.ts`.

## Phase 2 — Run the pipeline
- [ ] **2.1** `pnpm --filter web build && pnpm --filter web start &`
- [ ] **2.2** `pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/run-all.ts`
- Wall-clock ~30 min.

## Phase 3 — Wire URLs into web/
- [ ] **3.1** Components import from `web/src/lib/demo-assets.ts` (auto-generated).
- [ ] **3.2** Auto-commit URL swap.

## Phase 4 — Auto-acceptance
- [ ] **4.1** Lighthouse mobile: Perf ≥ 90, LCP ≤ 2.5s, A11y ≥ 95.
- [ ] **4.2** "agent" word audit: zero customer-facing matches.
- [ ] **4.3** Slack scope audit: zero matches in marketing surfaces.
- [ ] **4.4** Real-brand audit: grep customer-facing surfaces for "Nike", "Adidas", "Apple", "Sony", "Zara" — assert zero matches (must use fictional brands only).
- [ ] **4.5** ffprobe output durations match spec ±0.1s, 1080p, h.264 main.
- [ ] **4.6** `curl -I` each R2 URL: 200 + cache-control immutable.

---

# Cost reference

| Item | $ |
|---|---|
| fal.ai TTS (~50s of speech across 15 lines) | ~$3 |
| Puppeteer / ffmpeg / R2 egress | ~$0 |
| **Total per re-shoot** | **~$3** |

---

# Verbatim line bank

## Cut 1 — Pacelab Aero Run 4 (real-feeling buyer flow)

### User-side queries (4)
1. **(voice)** *"is this shoe having memory foam?"*
2. **(voice)** *"when can it be delivered to Bangalore?"*
3. **(text)** *"any discounts?"*
4. **(voice)** *"please add to cart"*

### Sage answers (4, English)
1. *"Yes — dual-density memory foam in the midsole. Great for daily 10K runs and standing all day."*
2. *"Standard delivery to 560001 is Tuesday. Express tomorrow by 9 PM."*
3. *"Yes — code FIRSTRUN gives you 12% off on your first order. Applied."*
4. *"Done. Aero Run 4 in size 9, your express delivery, ₹7,919 with FIRSTRUN."*

### Storefront values that update inline (visible, not voiced)
- **Cushioning section:** "Dual-density memory foam midsole · ZoomFlex heel pod · 12mm drop"
- **Delivery section:** "560001 · Standard Tue 12 Aug Free · Express tomorrow 9 PM +₹150"
- **Price:** ₹8,999 → ₹7,919 (with strikethrough on old + "−₹1,080 (FIRSTRUN)" subtitle)
- **Cart icon:** badge ticks 0 → 1
- **Cart drawer line item:** "Pacelab Aero Run 4 · UK 9 · Black/Rose · Express · ₹7,919"

## Cut 2 — Narrator (4 lines, English)
1. *"Thirty seconds. One line of code."*
2. *"Paste one line into your theme. No app store review. No SDK in your bundle."*
3. *"Refresh. Sage is live."*
4. *"Shopify, Woo, Magento, Wix, Squarespace, custom. Most competitors are Shopify-only. Not us. Thirty dollars a month. Seventy percent margin. shoppingmate.ai — your trial is the live demo on the page."*

## Cut 2 — Sage (1 line)
1. *"Hi! I'm Sage."*

## Cut 3 — User queries (4)
1. **(text)** *"will the M run small for slim fit?"* (Lumière jacket)
2. **(voice)** *"which one's better for voiceover?"* (Hexa mic comparison)
3. **(voice)** *"running shoes under five thousand with cushion"* (Stride sneaker results)
4. **(voice, Devanagari)** *"क्या यह मेरे साइज़ XL में है?"* (Lumière plus activewear)

## Cut 3 — Sage answers (4)
1. *"Lumière runs slim. You're a small in their fit — go XS in this jacket."*
2. *"The dynamic mic on the right rejects room noise better — better for untreated rooms."*
3. *"Three under five thousand with proper cushion: Pacelab Aero Lite, Stride Glide, Velocity 3."*
4. **(Hindi):** *"Haan, XL stock mein hai. Add karoon?"* (Spanish fallback: *"Sí, XL disponible. ¿Te lo agrego?"*)

## Cut 3 closing tag
> "One line of code. Every kind of buyer."

## Cut 4 bumper text
1. "Your storefront just learned to talk."
2. "And to sell."
3. "shoppingmate.ai — install in under 60s"

## Hero tagline (web copy)
> H1: "Your storefront just learned to talk. And to sell."
> Sub: "Paste one line of code. Sage learns your store in 8 minutes and starts building carts — picking variants, applying coupons, and handing off to your native checkout. No integrations. No PCI scope. No card data ever."
