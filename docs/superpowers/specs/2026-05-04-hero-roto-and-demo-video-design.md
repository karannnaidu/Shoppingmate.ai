# Hero roto.app animation + demo video package — Design Spec

**Date:** 2026-05-04
**Owner:** Karan (Calmosis) — execution by Claude Opus 4.7
**Phase:** Marketing surface (parallel to Phase 1 product work — does not block any plan)
**Predecessors:** Plans 1–6 code-complete (Hero, Demo, Cta sections already exist in `web/src/components/`)
**Successors:** Implementation plan (to be written next via `superpowers:writing-plans`)

---

## 1. Goal (one paragraph)

Replace shoppingmate.ai's current hero card and `<Demo />` section with a production-grade marketing surface that demonstrates the wedge — *"your storefront talks to visitors and closes the sale, on any platform"* — through (a) a **roto.app**-animated "living storefront" inside the existing hero card, surrounded by 8 microinteractions; (b) a **four-cut video package** generated via **seedance 2.0 on fal.ai** + **roto.app** + After Effects; and (c) a **new tagline** that retires "voice agent" language across the marketing surface. The package is for production: prefers-reduced-motion respected, ≤1.5 MB hero asset, self-hosted on Cloudflare R2, captions burned for muted social plays. Total fal.ai spend ≈ $60 for one production session.

## 2. Why this exists

The shoppingmate.ai landing page exists in `web/src/components/` (Hero, Demo, HowItWorks, Cta, etc.) but the hero shows a *typed* mockup conversation, not the product working. With Plans 1–6 code-complete and the live widget shippable, we now have the assets to show a real PDP being driven by Sage end-to-end. The marketing surface needs to catch up with the product. Separately, the strategy doc (`docs/strategy/2026-05-01-shoppingmate-strategy.md`) commits to consumption pricing with no free trial — *"the trial is the live demo on shoppingmate.ai"* — so the demo's quality is the funnel. This spec is the source of truth for that demo.

Two adjacent corrections this spec also delivers:

1. **Tagline retirement.** The existing hero says *"A voice agent that builds carts."* Founder feedback (2026-05-04, saved in `feedback_drop_agent_language.md`): drop "agent" language across all customer-facing copy; investors and customers are tired of it. New tagline: ***"Your storefront just learned to talk. And to sell."***
2. **Slack scope reaffirmed.** Brand-facing surfaces show the **shoppingmate dashboard** / push notifications, never Slack. Slack is internal-ops-only (per `feedback_slack_scope.md`).

## 3. Done-criteria

A visitor on shoppingmate.ai can:

1. See the new tagline in the hero (replaces the existing copy).
2. See the hero card's right-side panel show a roto.app-animated Glowderma PDP with the live demo conversation overlaid; eight microinteractions fire in sync with the demo loop; `useReducedMotion()` swaps to a static poster.
3. Scroll to the `<Demo />` section and click-to-play the **30s cinematic spot** (16:9), with burned-in captions and Sage's voice from the ship-product persona.
4. Scroll further and click-to-play the **20s persona montage** showing four buyer types across Shopify/Woo/Magento/Wix-shaped storefronts (fashion sizing, gadget comparison, hands-busy voice, Hindi inclusivity).
5. Optionally watch the **90s founder loom** in a "How it actually works" surface (or sales-follow-up email link).

The marketing team can:

1. Re-generate any cut from the runbook at `docs/runbooks/demo-video-production.md` without my context.
2. Pull the **6s bumper** from Cloudflare R2 for paid retargeting campaigns.
3. Swap the hero animation source asset for a different merchant (seasonal campaigns) by replacing files under `web/public/demo/` (or the CDN equivalent) — no code change.

If any of (1)–(5) above fails, this spec is not done.

## 4. Tagline + brand language

### 4.1 Tagline (locked)

> **Your storefront just learned to talk. And to sell.**

Used as: hero H1, video closing card, social share OG image.

**Sub-line (hero only):** *"Paste one line of code. Sage learns your store in 8 minutes and starts building carts."*

### 4.2 Brand language rules

- **Never call shoppingmate an "agent"** in customer-facing copy (landing, video, ads, decks, emails). Use verbs and outcomes: *talks, closes, sells, builds carts, applies coupons, redirects to checkout.* See `feedback_drop_agent_language.md`.
- **Persona name "Sage"** is fine — it's a name, not a category.
- **Slack never appears as a brand surface.** Notifications shown in marketing assets are push notifications from the **shoppingmate** dashboard app. See `feedback_slack_scope.md`.
- **Engineering vocabulary** ("agent runtime", `packages/agent/`) stays — internal docs and code are not customer-facing.

## 5. Hero roto.app animation

### 5.1 Concept (locked) — Concept A: Living Storefront

The right side of the existing hero card (a fake browser-chrome panel containing a product card, conversation bubbles, and a mic) gets a **roto.app**-animated Glowderma PDP screenshot in place of the static product card. Cursor moves, Add-to-Cart pulses, product image parallaxes, cart count ticks. Bubbles + mic + browser chrome stay.

**Why A over B (talking Sage avatar) or C (product talks back):** A *demonstrates* the value prop; B and C decorate it. A is also the only one that doesn't force a brand decision (no Sage face needed) and reuses cleanly in Cut 1 of the video.

### 5.2 Microinteractions catalog

All eight gated by `useReducedMotion()` → swap to static poster. Reuse existing `framer-motion`; no new deps.

| # | Interaction | Trigger | Spec |
|---|---|---|---|
| 1 | Magnetic mic button | Cursor within 80px | Button translates +4px toward cursor; spring (mass 0.4, damping 12) |
| 2 | Bubble spring stagger | Each new bubble | Replace existing `easeOut` with spring (mass 0.5, damping 12, stiffness 180) |
| 3 | Roto loop | Always (paused if reduced-motion) | Embedded PDP video loops 4–6s; 0.5% scale + 0.3° tilt within the loop |
| 4 | Sage cursor click | Bubble #3 ("pop both in your cart") fires | Soft cursor SVG glides PDP center → Add-to-Cart, clicks; cart count ticks 0→2 |
| 5 | Coupon stamp | Bubble #5 (WINTER15) fires | SVG stamp rubber-stamps price card; -2°→0° shake (0.3s) |
| 6 | Cart pill | After demo loop completes | "Added 2 items · ₹2,998 · Coupon applied" pill slides up from bottom-right with spring |
| 7 | CTA pulse | Loop completion | Primary "Install in 60 seconds" button gets one-time outward ring pulse (subtle, not nagging) |
| 8 | Reduced-motion swap | `useReducedMotion()` true | Static poster image; bubbles render in final state; no auto-loop |

### 5.3 roto.app asset specs

- **Source:** Glowderma PDP screenshot (`glowderma.in/products/sensitive-skin`) at 1440px width, 4× DPR.
- **Output:** MP4 (h.264 main profile, CRF 23) + WebM (VP9, CRF 30). Loop 5s. ≤1.5 MB combined.
- **Poster:** 1× still frame from t=0 of the loop, JPEG, ≤80 KB.
- **Embed:** `<video autoplay muted loop playsinline preload="metadata">` with `<source>` for both formats and `poster=` fallback.
- **LCP guard:** Hero H1 text is the LCP element, NOT the video. Preload the hero font; do **not** preload the video. Lazy-render the video element with Intersection Observer (only if visible — but the hero is above-fold so this is effectively eager). Confirm via Lighthouse that LCP < 2.5s on Slow 4G.

### 5.4 Hero copy changes (Hero.tsx)

| Element | Current | New |
|---|---|---|
| H1 | "The 24/7 sales floor your store never had. **A voice agent** that builds carts." | "**Your storefront just learned to talk.** And to sell." |
| Sub-line | "Paste one line of code. Within 8 minutes, an AI sales agent is live..." | "Paste one line of code. Sage learns your store in 8 minutes and starts building carts." |
| Primary CTA | "Install in 60 seconds" | (unchanged) |
| Secondary CTA | "Hear it talk" | (unchanged — already verb-led) |

## 6. Video package — four cuts

### 6.1 Voices and music (apply to all cuts)

- **SAGE** = the ship-product Gemini Live voice. **Critical brand consistency** — the voice merchants hear in the video must match the voice they hear in the live widget. Generate Sage TTS by piping the script lines through the same `voice-agent` runtime if possible; otherwise hand-match an ElevenLabs voice and document the parameters in the runbook.
- **VISITOR** = casual female, mid-20s tonally, slight smile in the read.
- **NARRATOR** = warm low-mid male; subscriber-podcast register, not movie-trailer.
- **Sage never voices numeric prices** (Plan 4's `stripPrices` invariant). When prices appear, they appear visually only.

### 6.2 Cut 1 — 30s Cinematic Spot

**Where it lives:** `<Demo />` section (click-to-play with audio) + paid social.
**Music:** ambient pad → gentle pulse from 0:09 → soft beat-build 0:19–0:28 → resolve.

| Time | Visual | Audio | On-screen text |
|---|---|---|---|
| 0:00–0:02 | Black. Brand mark fades in. Subtle violet→cyan glow under wordmark. | Single soft chime at 0:01. | **shoppingmate**<br>*talks to your visitors. closes the sale.* |
| 0:02–0:04 | Brand mark dissolves into a phone in a dark room. Hand begins scrolling a silent product page. | Ambient pad fades up. | *(none)* |
| 0:04 | Tagline overlays the phone. | Pad continues. | **Your storefront just learned to talk.** |
| 0:05–0:09 | Phone tilts toward camera. Sage bubble appears above PDP. | **VISITOR (VO):** *"Hey — got a fragrance-free moisturizer for winter?"* | *(Sage bubble, typed):* "Two strong matches in stock — both safe for sensitive skin." |
| 0:09–0:12 | Cursor (Sage) glides across PDP. Two product cards stream in. | **SAGE:** *"Want me to add both to your cart?"* | *(Visitor reply):* "Yes please — and any coupon you've got." |
| 0:12–0:15 | Cursor clicks Add-to-Cart twice. Cart pill ticks 0 → 2. | Soft click SFX × 2, confirm chime. | *(Cart pill):* "Added 2 items · ₹2,998" |
| 0:15–0:19 | WINTER15 coupon rubber-stamps onto price card with -2°→0° shake. | Stamp SFX. **SAGE:** *"WINTER15 applied — saved you ₹420."* | **Stamp: WINTER15 −₹420** |
| 0:19–0:23 | Phone face-up on dark nightstand at night. Lock screen lights up with a **shoppingmate** push notification. Slow camera push-in. | Soft phone push-notification chime. **NARRATOR (low):** *"While you sleep…"* | *(Push):* **shoppingmate** · now<br>*"Sage just closed a $79 order on Glowderma. View in dashboard →"* |
| 0:23–0:28 | Logo wall morphs: Shopify → Woo → Magento → Wix → Squarespace → "+ custom". | Beat builds. **NARRATOR:** *"Live on every store you sell on. Installed in 60 seconds."* | *(Lower-third):* "Shopify · Woo · Magento · Wix · Squarespace · Custom" |
| 0:28–0:30 | Tagline card on brand violet→cyan gradient. Logo + URL. | Final swell. **NARRATOR:** *"shoppingmate-dot-ai. Your storefront just learned to sell."* | **Your storefront just learned to talk. And to sell.** *(below)* shoppingmate.ai |

**Asset note (0:19–0:23):** Phone mockup + push notification card built in After Effects (text legibility on small UI is unreliable from video models). seedance 2.0 generates only the dark-bedroom plate and the slow push-in.

### 6.3 Cut 2 — 90s Founder Loom

**Talent:** Karan, webcam bubble bottom-right + screen share.
**Tone:** unedited, no music, real cursor, real typing, real installation. **Zero cuts allowed.**
**Lower-third on screen 0:00–0:04:** **shoppingmate · talks to your visitors. closes the sale.**
**Beats are floor not ceiling — verbatim "HARD LINES" must land; improvise the connectors.**

```
[0:00 – 0:05]  COLD OPEN — webcam only
  HARD LINE: "I'm gonna make this Shopify store start talking
              to its customers — and selling to them — in under
              60 seconds. No edits."
  → cursor moves to tab labeled "Glowderma admin"

[0:05 – 0:20]  THE INSTALL — screen share
  HARD LINE: "Theme settings → custom code → paste one line."
  → paste <script src="https://cdn.shoppingmate.ai/v1.js"
                  data-id="SM-7K2"></script>
  → save → switch to storefront tab → refresh
  HARD LINE: "That's it. The pill is live in the bottom-right.
              No app store review. No theme edits. No SDK in
              the bundle."
  Stat lower-third (burned in): "TTI impact: +0.4s on 3G"

[0:20 – 0:45]  THE ONBOARDING — fast-forward over 8 minutes
  HARD LINE: "Behind the scenes, Sage is reading your store —
              vision-grounded, server-side. Eight minutes from
              now it knows your catalog, your variants, your
              coupon rules, and exactly which selectors to click
              on every PDP."
  Visual: time-lapse "Onboarding 38% → 71% → 100% ✓"
  HARD LINE: "And here's the thing competitors hate: we work on
              Woo, Magento, Wix, Squarespace, and fully custom
              stores. Most of them are Shopify-only."

[0:45 – 1:10]  THE LIVE CONVERSATION — back to storefront
  HARD LINE: "Now I'm a visitor. I'm gonna talk to it. Out loud."
  → click pill → mic permission → say:
       "I want a moisturizer for sensitive skin in winter."
  → Sage replies in voice. Two product cards stream in.
  → say: "Add the second one."
  → cart updates live.
  HARD LINE: "Notice three things — Sage spoke the variants, never
              said the price out loud, and the cart updated by
              clicking the same buttons a human would. No DOM
              hacking. No checkout stack to re-architect."

[1:10 – 1:25]  THE TRUST BEATS
  HARD LINE: "$30 a month to start. No trial gimmicks — your
              trial is the live demo on shoppingmate.ai. You see
              it work before you pay a rupee."
  HARD LINE: "Worst case unit economics: 70% gross margin. Voice
              included on every plan. We made it Day 1 profitable
              on purpose — because we want you to stay, not churn."

[1:25 – 1:30]  CLOSE — webcam only
  HARD LINE: "shoppingmate.ai. Sixty seconds to install. Eight
              minutes to learn your store. Then it sells while
              you sleep. I'll see you in your dashboard."
  → freeze frame on URL
```

**Captions:** burned `.vtt` track only (loom is click-to-play).

### 6.4 Cut 3 — 20s Persona Range Montage

**Where it lives:** "Built for every kind of buyer" strip below the hero + paid variants by vertical.
**Music:** continuous house-y pulse, beat drop on brand mark, one beat per scene, resolve on tagline.

| Time | Persona | Visual | Audio | On-screen text |
|---|---|---|---|---|
| 0:00–0:01 | — | Black. Brand mark snap-in: **shoppingmate**. Beat drop simultaneous. | Beat drop. | **shoppingmate** |
| 0:01–0:05 | Fashion · sizing | Phone, Shopify-shaped storefront. Jacket PDP. | **VISITOR:** *"I'm 5'8", 145 — what size in this?"* **SAGE:** *"Size M. It runs slim. Adding the M."* | *(Cart pill):* "1 jacket · size M added" |
| 0:05–0:09 | Gadget · comparison | Desktop, Woo-shaped storefront. Two podcast mics side-by-side. | **VISITOR:** *"Best podcast mic under $200?"* **SAGE:** *"Two top picks. The MV7 wins on noise rejection. Adding it."* | *(Comparison badge):* "MV7 — winner" → *(Cart pill):* "1 mic added" |
| 0:09–0:14 | Voice-first · hands-busy | Kitchen, hands wet, phone propped on counter. Custom-stack-shaped PDP. | **VISITOR (over running water):** *"Add the bamboo matcha whisk to my cart."* **SAGE:** *"Done. Bamboo whisk added."* | *(Cart pill):* "1 whisk added" *(Lower-third):* **Voice when hands can't.** |
| 0:14–0:19 | Inclusive · non-English | Phone, Wix-shaped storefront. Plus-size activewear PDP. | **VISITOR (Hindi):** *"क्या ये XXL में है, और क्या ये पसीना सोखता है?"* **SAGE (Hindi):** *"हाँ — XXL स्टॉक में है, ड्राय-फिट है। कार्ट में डाल दिया।"* | *(English subtitle):* "Got XXL? Sweat-wicking?" / "Yes — in stock, dry-fit. Added." |
| 0:19–0:20 | — | Tagline card. Logo morph behind. | Final beat. **NARRATOR (fast):** *"Every store. Every buyer. Every language."* | **One line of code. Every kind of buyer.** · shoppingmate.ai |

**Voice direction (Hindi scene):** native casual urban Hindi (Delhi/Mumbai register, not news Hindi). Same Sage voice switching language natively — that code-switch is itself a flex. **Record an English-language fallback take** in case the model's Hindi is shaky on review; if the Hindi take is unusable, swap to a Spanish take using the same structure rather than abandoning the inclusivity beat.

### 6.5 Cut 4 — 6s Bumper

**Where it lives:** paid retargeting only (not on landing page).
**Plays muted, reads at a glance, single message.**

| Time | Visual | Audio | On-screen text |
|---|---|---|---|
| 0:00–0:01 | Silent storefront. | Single chime. | *(none)* |
| 0:01–0:04 | Cursor clicks Add-to-Cart × 2. Cart pill: 0 → 2 · ₹2,998. WINTER15 stamps. | Click × 2, stamp SFX. | *(Cart pill animates)* |
| 0:04–0:06 | Tagline card. | Silent on URL. | **Your storefront just learned to sell.** *(below)* shoppingmate.ai · install in 60s |

## 7. Production pipeline

### 7.1 Asset sources

1. **Glowderma PDP screenshot** (`glowderma.in/products/sensitive-skin`) at 1440px width — used for hero loop, Cut 1, and Cut 4.
2. **Platform-shaped storefront screenshots** for Cut 3 — four mock PDPs with theme cues that read as Shopify / Woo / Magento / Wix without using their actual logos (avoids trademark friction).
3. **Real product photos** (4–5) for the platform-shaped PDPs in Cut 3.
4. **Logo files** for Cut 1 logo wall — Shopify, Woo, Magento, Wix, Squarespace (use official press-kit assets).

### 7.2 roto.app pass

- Hero loop: 4–6s, no audio. Output MP4 + WebM. Target ≤1.5 MB combined.
- Cut 1 storefront-comes-alive segment (0:05–0:18, 13s). Output MP4 only.
- Cut 3 four overlay segments (4–5s each). Output MP4 only.

### 7.3 fal.ai seedance 2.0 pass

- **Cut 1 plates:** dark-room phone scrolling (3s) + dark-bedroom nightstand push-in (4s). Budget 3 takes per plate. ≈ $22.
- **Cut 3 plates:** four 5s storefront/setting plates that roto.app overlays the conversation onto. Budget 3 takes per plate. ≈ $38.
- **Use the official `@fal-ai/serverless-client`** with `FAL_KEY` from `.env`. Generation script lives at `apps/api/scripts/video-gen/` (or `ops/video-gen/`).

### 7.4 Sage voice pass

Pipe each Sage line in the script through the ship-product voice runtime (LiveKit / Gemini Live persona). If pulling from the runtime is impractical for asset generation, use ElevenLabs with the same voice ID and pitch/stability documented in the runbook so future re-shoots match.

### 7.5 Edit pass (DaVinci Resolve free or Capcut)

- Compose roto.app + seedance plates + AE overlays + voice + SFX.
- Burn captions on Cut 1 + Cut 3 + Cut 4. Generate `.vtt` track for Cut 2.
- Export each cut as 16:9 (1920×1080), 9:16 (1080×1920), 1:1 (1080×1080). All h.264 main profile, CRF 23.
- Cut 1 ≤8 MB; Cut 3 ≤6 MB; Cut 2 lazy-loaded so ≤30 MB acceptable; Cut 4 ≤1.5 MB.

### 7.6 Hosting & embed

- Self-host on **Cloudflare R2** behind `cdn.shoppingmate.ai/demo/`. **No YouTube embed** (kills LCP and adds tracking we don't want).
- Local `web/public/demo/` keeps small previews and posters for dev environments.
- Embed via `<video preload="metadata">` (NOT `preload="auto"` — kills LCP). Click-to-play for cuts with audio; autoplay-muted-loop for the hero asset only.

## 8. Files this package touches

```
docs/
├── superpowers/specs/2026-05-04-hero-roto-and-demo-video-design.md  (this spec)
├── superpowers/plans/2026-05-04-hero-roto-and-demo-video-plan.md    (next, via writing-plans)
└── runbooks/demo-video-production.md                                (re-shoot runbook)

web/
├── src/components/Hero.tsx        (new tagline + roto asset + 8 microinteractions)
├── src/components/Demo.tsx        (embed Cut 1 — 30s cinematic)
├── src/components/PersonaRange.tsx (NEW — embed Cut 3 — 20s persona montage)
├── src/components/FounderLoom.tsx (NEW — embed Cut 2 — 90s loom, click-to-play with .vtt track)
├── src/components/HowItWorks.tsx  (unchanged — FounderLoom is its own section to keep concerns separate)
├── public/demo/                   (poster images + small previews; full assets on CDN)
└── ...

apps/api/scripts/video-gen/        (NEW — fal.ai + roto.app generation scripts)
├── generate-cinematic-plates.ts
├── generate-persona-plates.ts
└── README.md

.env                               (FAL_KEY added — already done in this session)
.env.example                       (FAL_KEY placeholder added — already done)
```

## 9. Production-readiness checklist

- [ ] `useReducedMotion()` swaps every animation to a static poster.
- [ ] LCP element = H1 text, not video. Hero font preloaded; video lazy-loaded with `preload="metadata"`.
- [ ] Hero asset ≤1.5 MB combined (MP4 + WebM).
- [ ] Cut 1 ≤8 MB, Cut 3 ≤6 MB, Cut 4 ≤1.5 MB. Cut 2 lazy-loaded so 30 MB OK.
- [ ] All videos `<video muted playsinline>` baseline; only the hero loop is autoplay-muted-loop.
- [ ] Captions burned-in on Cut 1, Cut 3, Cut 4. `.vtt` track on Cut 2.
- [ ] DOM transcript for Cut 2 (SEO + a11y).
- [ ] Self-hosted on Cloudflare R2; no YouTube/Vimeo embeds.
- [ ] Bundle: zero new dependencies. `framer-motion` reused.
- [ ] Lighthouse perf ≥90 on the landing page after the changes ship.
- [ ] No "agent" word in any customer-facing copy across hero, video, page sections.

## 10. fal.ai cost summary

| Cut | Generated seconds | Takes | Cost @ $0.62/s |
|---|---|---|---|
| Cinematic (Cut 1) — 7s plates | 7s × 3 takes = 21s | 3 | ~$13 |
| Cinematic buffer + iteration | ~15s | 1 | ~$9 |
| Persona montage (Cut 3) | 20s × 3 takes = 60s | 3 | ~$38 |
| **Total** | — | — | **~$60** |

Loom (Cut 2) and bumper (Cut 4) cost $0 in fal.ai spend.

## 11. Out of scope (intentional)

- **A/B-tested vertical landing pages** (`/for/fashion`, `/for/electronics`). Mentioned in Cut 3 brainstorming; deferred until the persona montage proves the verticals worth promoting.
- **A Sage avatar / face for the brand.** Concept B (talking Sage avatar) was rejected during brainstorming. If the brand decides to ship a face later, it can come back as a separate spec.
- **Localized full landing pages.** The Hindi line in Cut 3 demonstrates capability; localized landing pages are a Wave 2/3 effort.
- **Re-cutting the existing typed mockup conversation in Hero.tsx.** The bubbles + typing logic stay; only the right-side product card is replaced with the roto-animated PDP.
- **Updating Hero.tsx beyond the H1 sub-line + right-side panel + microinteractions.** Other sections of the landing (Pricing, Faq, Cta) keep their current language; flag any "agent" instances they contain in the implementation plan but don't rewrite copy outside this spec's scope.

## 12. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hindi take from Sage voice is unintelligible | Medium | Record English fallback in same session; swap if Hindi fails review |
| seedance 2.0 plates require >3 takes for usable output | Medium | $20 buffer baked into fal.ai budget |
| roto.app output exceeds 1.5 MB hero budget | Low | Compress with ffmpeg post-export (CRF 28 fallback); accept 2 MB if visually critical, document trade-off |
| Cloudflare R2 not yet provisioned | Unknown | If not, fall back to Vercel `public/` for Cut 4 and a temporary signed S3 URL for Cuts 1–3; runbook covers both |
| LCP regression from hero video | Medium | Lighthouse check is a release gate; if LCP > 2.5s, ship without autoplay loop and only trigger on intersection |
| Sage TTS in video doesn't match live widget tone | High if not deliberate | Generate via the ship runtime path; document voice parameters in runbook |

## 13. Acceptance criteria

This spec is implementable when:

1. All four cuts have full storyboards ✓
2. All cuts cite source assets and pipeline ✓
3. Tagline locked ✓
4. Hero animation concept locked + microinteractions enumerated ✓
5. fal.ai cost projected ✓
6. Files-touched list complete ✓
7. Production-readiness checklist measurable ✓
8. Out-of-scope explicit ✓
9. No "agent" word in customer-facing copy ✓
10. Slack absent from brand-facing surfaces ✓

The next step is `superpowers:writing-plans` to produce an implementation plan that sequences: (a) hero copy + animation, (b) video asset generation, (c) embed components, (d) runbook + ops.
