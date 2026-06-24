# shoppingmate — Strategy & Operations Blueprint

**Date:** 2026-05-01
**Author:** Claude (acting CEO, per founder mandate)
**Status:** v0.1 draft for board review
**Scope:** Market, competitors, unit economics, 24-month plan, board deck, Slack-as-OS, hiring & docs operating model

> ⚠️ Every number with a `≈` is a defensible estimate, not a measured fact. Challenge them — that's the point of v0.1. Sections marked **DECISION** are calls I'm making on your behalf so we don't stall; reverse them by writing "no" next to the line.

---

## 0. Executive summary

**What we are.** shoppingmate is the first cross-platform AI shopping copilot that any brand can install in 60 seconds via a single gtag — no app-store review, no theme edits, no SDK in the visitor's bundle. We work on Shopify, WooCommerce, BigCommerce, Magento, Wix, Squarespace, *and* fully custom storefronts, because our onboarding pipeline does vision-grounded selector extraction server-side and ships the visitor a thin runtime that only executes pre-validated selectors.

**Why now.** Three curves cross in 2026: (a) Sonnet/Haiku 4.x unit costs are 5-10× cheaper than 2024 GPT-4-class models, making per-conversation economics work below $0.01; (b) Shopify Sidekick has trained the market that AI copilots belong on PDPs, but locks Shopify-only — leaving 60%+ of the world's stores unserved; (c) consumer-side agents (Operator, Computer Use, Rufus, Perplexity Shopping) will disintermediate brands that don't own the on-site experience.

**Wedge.** Cross-platform, sub-minute install, vision-grounded selector caching. Direct competitors are Shopify-only (Rep AI, Octane, Manifest, Sidekick) or platform-locked enterprise plays (Klevu, Bloomreach). The long tail of custom storefronts — ~12% of stores, ~25% of GMV — is currently un-addressable for them and is our moat.

**Year-1 target.** $150K MRR / ~1,000 paying merchants by Apr 2027. Bootstrap-able with a $1.5M seed; comfortable with $3M.

**3-year vision.** $1M MRR by month 30, marketplace + vertical specializations, Series A by month 18 at the $50-80M post-money tier with $4-6M ARR run rate.

**Operating model.** Slack is the OS — every operational decision flows through Slack channels with Claude Agent SDK + Composio MCP toolkits in the loop. Hiring, billing ops, churn response, content marketing, customer support, and incident response are all agent-driven with human approval gates. Target: 12-person team running like 50.

---

## 1. Market analysis

### 1.1 Category

We sit at the intersection of three categories:

| Category | Examples | Our angle |
|---|---|---|
| Conversational commerce / on-site AI assistants | Tidio Lyro, Drift, Intercom Fin, Rep AI | We're cross-platform and PDP-native, not chatbot-shaped |
| Site search & discovery | Klevu, Algolia AI, Bloomreach, Manifest AI | We sit *on top* of search and convert intent → action |
| AI agents for retail | Zowie, Ada, Maven AGI | We're horizontal and merchant-installable, not enterprise-services-led |

**Positioning statement.** *shoppingmate is the AI shopping copilot you drop in via gtag and forget — it learns your store overnight and sells like your best store associate from day two, on any e-commerce stack.*

### 1.2 TAM / SAM / SOM

| Layer | Size | Logic |
|---|---|---|
| **TAM** — global e-commerce stores with traffic > 100 visits/day | ≈ 14M stores | Shopify 4.5M, Woo 6M, BigC/Magento/Wix/Squarespace ≈ 2.5M, custom long tail ≈ 1M |
| **SAM** — English-first stores with > $100K GMV/yr (can pay $99+/mo) | ≈ 3.2M stores | Industry data on Shopify Plus + Woo enterprise + BigC etc. |
| **SOM (3yr)** — stores we can plausibly reach via PLG + app stores + partners | ≈ 80K stores | 2.5% penetration of SAM; benchmarked vs. Tidio's ~300K free + paid mix at 8 yrs |

**Revenue-side sizing.** AI commerce SaaS market: ≈ $4.5B in 2026 → ≈ $15B by 2029 (≈ 50% CAGR per Gartner/Forrester triangulation). Avg ARPU in the $99-249 band for SMB, $1-5K for mid-market.

If we capture 1% of SAM at blended $129 ARPU: 32K stores × $129 × 12 = **$50M ARR**. Aggressive but not heroic.

### 1.3 Geographic priorities (sequenced)

| Priority | Markets | Why |
|---|---|---|
| **Wave 1 (months 0-12)** | US, UK, Canada, Australia | English, Stripe-native, Shopify-heavy, highest ARPU |
| **Wave 2 (months 13-18)** | Germany, France, Netherlands, Spain | Largest non-English Shopify markets; payment infra ready |
| **Wave 3 (months 19-24)** | India, Brazil, Mexico, Indonesia, Vietnam | Massive store volume, lower ARPU ($29-49 tier), faster CAC payback at scale; India alone has > 500K active e-comm stores and Hindi/Tamil/Bengali Haiku quality is now production-ready |
| **Long-term (months 25+)** | Japan, Korea, Middle East | Higher localization burden, deferred |

**DECISION.** Wave 3 starts month 13, not earlier. India is huge but ARPU/CAC in the US is 4-6× better — we earn the right to expand by hitting $150K MRR in Wave 1 first.

### 1.4 Why now (the timing wedge)

1. **LLM cost collapse.** Haiku 4.5 at ≈ $0.001/1K input tokens makes a 10-turn shopping conversation cost ≈ $0.005. At $99/mo per merchant with 3,000 conversations/mo, COGS is ≈ $15 — 85% gross margin.
2. **Shopify Sidekick has done category education for free.** Merchants now ask "where's our AI?" without us evangelizing.
3. **Operator/Computer Use/Rufus disintermediation panic.** Brands are realizing they need to *own* the AI layer on their own site or lose the customer relationship to the consumer agents. shoppingmate is the install-and-keep-control answer.
4. **Composio + MCP standardization** means our integration cost per platform is dropping monthly — moats from integration breadth are now achievable in months, not years.

---

## 2. Competitive landscape

### 2.1 Direct competitors

| Vendor | Category | Pricing | Funding | Strength | Weakness vs. us |
|---|---|---|---|---|---|
| **Shopify Sidekick** | Built-in AI | Free w/ Shopify | n/a (Shopify) | Default, free, deep integration | Shopify-only; merchant-facing not visitor-facing |
| **Rep AI** | Shopify shopping AI | $79-499/mo | ≈ $10M | Strong PDP UX, conversion-focused | Shopify-only; per-conversation pricing punishes growth |
| **Octane AI** | Shopify quizzes + AI | $50-500/mo | ≈ $11M | Quiz funnels, Klaviyo integration | Shopify-only; quiz-shaped, not copilot-shaped |
| **Manifest AI** | Shopify AI search | $49-499/mo | ≈ $5M | Fast search, decent UX | Shopify-only; search-shaped |
| **Tidio Lyro** | Cross-platform chatbot | $39-749/mo | ≈ $25M | Multi-platform, established | Chat-shaped not commerce-shaped; conversion lift unclear |
| **Klevu** | Search + AI for retailers | $499-2K+/mo | ≈ $20M | Enterprise-grade, strong search | Heavyweight install, not PLG |
| **Bloomreach** | Enterprise commerce AI | $2K-50K/mo | ≈ $450M raised | Enterprise creds, depth | Wrong tier — we're SMB/mid |
| **Zowie** | E-comm AI support | $1K+/mo | ≈ $20M | Support-focused excellence | Support-shaped not sales-shaped |
| **Ada** | AI customer service | $2K+/mo | ≈ $250M | Enterprise CS leader | Not a shopping copilot; CS-flavored |

**Net read:** No existing player offers (a) cross-platform install in 60s, (b) PDP-native shopping copilot UX, (c) SMB price points, all three. The intersection is empty. That's our box.

### 2.2 Indirect / disintermediation threats

| Threat | Risk to us | Mitigation |
|---|---|---|
| **OpenAI Operator / Claude Computer Use** doing on-merchant shopping for users | Medium-high — could route around our widget | Position as the *merchant-controlled* AI surface; sell the brand-control narrative; expose a `shoppingmate.json` manifest that consumer agents can use → we become the standard |
| **Shopify Sidekick going visitor-facing** | High if it happens — Shopify has the distribution | Bet on cross-platform; own Woo/BigC/custom long tail; move fast on Wave 2/3 geography before Sidekick localizes |
| **Amazon Rufus / Google AI Overviews shopping** keeping shoppers off brand sites | High at platform level, low at our level | Brands paying us *because* of this — we're the on-site retention play |
| **Klaviyo / Attentive bundling AI copilot** | Medium — they have the merchant relationship | Partner before they build; offer reseller tier |

### 2.3 Our defensible moat

1. **Vision-grounded selector cache** — proprietary mapping of (merchant_id → element selectors) accumulated from Playwright + Sonnet runs. After 10K merchants, we've seen every theme variant and every storefront pattern. Replicating this is a 12-18 month catch-up for any new entrant.
2. **Cross-platform breadth** — by month 12 we ship Shopify, Woo, BigC, Magento, Wix, Squarespace, and custom-DOM. Single-platform competitors take 6+ months per new platform.
3. **Thin client + own telemetry** — no third-party SDK bloat, conversion lift is measurable, and we're not vulnerable to Tidio-style "this slowed our site" backlash.
4. **PLG + Composio MCP-driven ops** — we run lean. At $1M ARR we're ≈ 12 people; competitors are 40-80 people at the same revenue.

---

## 3. Product wedge

Already defined in `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md` and `docs/superpowers/roadmap.md`. Summary of what makes the product defensible:

- **gtag install.** No Shopify App Store review (≈ 2-week lag killer). Merchant pastes a snippet, we provision in `<60s` (Plan 2 already done).
- **Server-side fingerprint → adapter selection.** Shopify/Woo/BigC use platform APIs (cheap, fast, accurate). Custom storefronts get the Playwright + vision-grounded selector path (expensive but rare and high-value).
- **Cached selector contract.** Visitor's browser only ever runs pre-validated CSS selectors that produced a successful synthetic cart-add during onboarding. No live LLM-driving-DOM at runtime — that's the safety story for enterprise sales.
- **Own telemetry (own WebSocket, no GA/Sentry/Mixpanel SDK in visitor bundle).** Bundle stays under 14KB gzipped. This is a real selling point post-Cookiebot/CMP fatigue.

---

## 4. Pricing & monetization

### 4.1 Plans (DECISION) — consumption-priced, profitable from day one

**One pricing unit: conversations** (also called "calls"). One conversation = one visitor copilot session, regardless of turns or modality (text, voice, or mixed). Voice is **included in every plan** — no separate voice cap, no per-minute overage. Per-conversation hard caps prevent runaway cost (see §4.1.1).

| Plan | Price/mo | Conversations/mo | Stores | Localizations | Support response | Target |
|---|---|---|---|---|---|---|
| **Starter** | $30 | 100 | 1 | 1 | Email, 24h | New / sub-$200K GMV merchants |
| **Growth** | $99 | 500 | 1 | 2 | In-app chat + email, 12h | $200K-2M GMV |
| **Scale** | $299 | 2,000 | 3 | 5 | In-app chat + priority email, 8h | $2M-20M GMV |
| **Pro** | $799 | 10,000 | 5 | unlimited | Shared Slack + priority, 4h | $20M+ GMV / Shopify Plus |
| **Enterprise** | custom (≥ $2K) | contracted | unlimited | unlimited | Dedicated CSM + 99.9% SLA | Multi-brand / strategic |

**Effective price per conversation** drops from $0.30 (Starter) → $0.20 (Growth) → $0.15 (Scale) → $0.08 (Pro). Merchants see the volume break and self-upgrade.

**Annual discount:** 20% (drives cash + retention).
**No free or trial tier.** The "trial" *is* the live demo on shoppingmate.ai's landing page — visitors interact with a real copilot on a sample storefront, then sign up directly at Starter ($30). Cleaner than a free-tier funnel: no trial-to-paid conversion math, no expiring-credit support load, no paywall to manage. First paid conversation happens day 1.
**No legacy per-minute voice billing.** A 5-min voice conversation costs the same one-conversation credit as a 4-turn text exchange.

#### 4.1.1 What counts as one conversation (publish on docs.shoppingmate.com)

| Rule | Value | Why |
|---|---|---|
| Hard cap per conversation: turns | 15 | Limits runaway long sessions; 95th-pct real session is 6 turns |
| Hard cap per conversation: voice minutes | 3 | Voice is the cost driver; tighter cap = enforceable margin floor |
| Hard cap per conversation: total duration | 25 min | Prevents idle drain |
| Idle timeout (session end) | 25 min | Same visitor reopening within 25 min = same conversation |
| "No-reply" sessions (visitor opens, closes < 5s, no agent reply) | Not counted | Anti-gaming for visitor + can't blame merchant |
| Bot/scraper traffic (UA + behavior detection) | Not counted | Can't drain merchant credits |
| Conversation that hits a hard cap | Counts as 1; new conversation if continued | Predictable per-conv ceiling |

**Per-conversation ceiling cost (LLM + voice + transport, worst case at all caps):** ≈ $0.092. **Realistic blend:** ≈ $0.009 (70% short text, 20% long text, 10% voice). With Haiku-default text routing (Sonnet only on tool-use turns) and tightened caps, the worst-case ceiling is 2.5× lower than v0.1 — every plan stays GM-positive even at 100% voice abuse with the §5.3 surcharge active.

### 4.2 Add-ons & top-ups (revenue expansion)

**Conversation top-up packs** (one-time, never expire — top up to extend current month or carry forward):

| Pack | Price | Effective $/conv | Use case |
|---|---|---|---|
| 50-pack | $19 | $0.38 | One-off overflow |
| 200-pack | $59 | $0.30 | Promo-week overflow |
| 1,000-pack | $199 | $0.20 | Steady volume bump |
| 5,000-pack | $799 | $0.16 | Mid-market burst |

**Auto-recharge** (DECISION). Merchant configures in dashboard: "when balance drops below `[10%]`, auto-charge `[$59 / 200-pack]`." Stripe off-session payment, instant credit, email + dashboard receipt. Hard guardrail: max 3 auto-recharges per billing period before merchant must approve manually (anti-runaway from a viral spike or bot attack).

**Subscription add-ons** (recurring):

- **Theme-change auto-recheck** — $29/mo. DOM diff watcher; re-runs selector extraction when merchant pushes a theme update.
- **A/B test runner** — $49/mo. Conversion-lift attribution dashboard.
- **Multi-brand parent account** — $99/mo per additional brand (agencies/holdcos).
- **Brand-tuned voice persona** — $99/mo. Custom voice timbre + brand-tone system prompt + paraphrasing rules.
- **Priority crawl & re-index** — $79/mo. Daily catalog refresh instead of weekly.

**Why top-ups + auto-recharge instead of overage billing:** top-ups are predictable (merchant approves the SKU), packs come with a volume discount the merchant feels, and we collect cash up-front rather than invoicing for overage at month-end (which is where Tidio/Rep AI lose merchants who hate "surprise bills").

### 4.3 Path to revenue milestones (revised for consumption pricing)

ARPU is lower per-merchant under the new pricing (lower tiers, more SMBs land on Starter), so we win on **merchant count** + **top-up upside** + **higher gross margin per dollar**. Top-up revenue alone adds ≈ 15-25% to subscription MRR at scale (industry benchmarks: Twilio, OpenAI API consumer apps).

| Milestone | Merchants | Blended sub. ARPU | Top-up upside | MRR | When |
|---|---|---|---|---|---|
| First $10K MRR | ≈ 180 | $48 | +15% | $10K | Month 6 |
| $50K MRR | ≈ 750 | $58 | +18% | $50K | Month 9 |
| $150K MRR | ≈ 1,900 | $68 | +20% | $150K | Month 12 |
| $500K MRR | ≈ 5,200 | $80 | +22% | $500K | Month 18 |
| $1M MRR | ≈ 9,000 | $93 | +24% | $1M | Month 30 |

ARPU climbs as Scale/Pro/Enterprise mix grows. Top-up upside grows because heavier-volume merchants buy bigger packs more often. The merchant-count target is roughly 2× the previous (higher-priced) plan because Starter at $30 lets us land brands we couldn't at $99.

---

## 5. Cost model & unit economics

### 5.1 Per-conversation COGS (the unit that matters)

With consumption pricing, the question shifts from "is plan X profitable" to "is one conversation profitable" — because every plan is a multiple of the same unit cost.

**Routing rule:** Haiku 4.5 is the default text model. Sonnet 4.6 is invoked only on tool-use turns (catalog search, cart actions, order lookup) and onboarding selector extraction. This is a hard engineering invariant — see §5.4.

**Conversation COGS — typical blend** (70% short text 3 turns, 20% long text 10 turns, 10% voice ~2-min mixed):

| Line item | $/conversation | Note |
|---|---|---|
| Text LLM (Haiku-default; ≤2 Sonnet tool-use turns/conv, prompt-cached) | $0.0030 | 90%+ system-prompt cache hit |
| Voice runtime (Gemini 2.5 Flash Live, 10% mix × ~2 min × $0.025/min) | $0.0050 | *Verify rate in pilot* |
| LiveKit WebRTC transport + bandwidth | $0.0010 | |
| **Subtotal — typical conversation** | **$0.0090** | |

**Conversation COGS — worst case** (full caps: 15 turns text + 3 min voice, all Sonnet on tool-use):

| Line item | $/conversation | Note |
|---|---|---|
| Text LLM (15 turns: 12 Haiku + 3 Sonnet tool-use, cached) | $0.015 | |
| Voice runtime (3 min Gemini Live native audio) | $0.075 | $0.025/min × 3 |
| LiveKit transport + bandwidth | $0.002 | |
| **Subtotal — worst case** | **$0.092** | |

The **per-conversation ceiling of $0.092** is the hard guarantee that lets us price every tier profitably. Cap reductions (20→15 turns, 5→3 min voice) plus Haiku-default routing drop the ceiling 2.5× from v0.1 ($0.235 → $0.092) and put us in 70%+ GM territory at every plan, even at 100% voice abuse with the §5.3 surcharge active.

### 5.2 Per-plan unit economics (Day-1 profitable check)

**Typical blend** (10% voice, $0.009/conv typical COGS):

| Plan | Price | Convs incl. | Typical COGS | Stripe + infra + support | Typical GM |
|---|---|---|---|---|---|
| **Starter** $30 | $30 | 100 | $0.90 | $4.50 | **$24.60 (82%)** ✅ |
| **Growth** $99 | $99 | 500 | $4.50 | $7.50 | **$87.00 (88%)** ✅ |
| **Scale** $299 | $299 | 2,000 | $18.00 | $14.50 | **$266.50 (89%)** ✅ |
| **Pro** $799 | $799 | 10,000 | $90.00 | $32.00 | **$677.00 (85%)** ✅ |

**Worst case — 100% voice abuse with §5.3 surcharge active** ($0.092/conv worst case; surcharge $0.30/voice-conv above 20% voice ratio):

| Plan | Base price | Worst COGS (convs × $0.092) | Stripe + infra + support | Surcharge revenue (80% of convs × $0.30) | Total revenue | Worst-case GM |
|---|---|---|---|---|---|---|
| **Starter** $30 | $30 | $9.20 | $4.50 | $24.00 | $54.00 | **$40.30 (75%)** ✅ |
| **Growth** $99 | $99 | $46.00 | $7.50 | $120.00 | $219.00 | **$165.50 (76%)** ✅ |
| **Scale** $299 | $299 | $184.00 | $14.50 | $480.00 | $779.00 | **$580.50 (75%)** ✅ |
| **Pro** $799 | $799 | $920.00 | $32.00 | $2,400.00 | $3,199.00 | **$2,247.00 (70%)** ✅ |

**Without surcharge,** Starter still clears 54% on pure-voice abuse but Growth/Scale/Pro go negative. **The voice-fairness surcharge is the margin floor mechanism** — not a punishment, a billing-truth correction that scales with actual cost. Disclosed up front; merchants who run > 20% voice are in the minority and self-select into a fair-cost tier.

**Realistic-blend GM (10% voice, no surcharge triggered): 82-89% across all plans.** Day-1 profitable from Starter upward.

### 5.3 Margin guardrails (DECISION — must build into Plan 4)

1. **Voice-fairness rule.** If a merchant's voice-conversation ratio exceeds **20%** in a billing period, the plan auto-applies a *voice surcharge* of **$0.30 per voice conversation above the 20% threshold**. Disclosed in pricing copy, the dashboard, and the bill itself — no surprise. Catches outlier voice-heavy merchants without punishing typical traffic. **This surcharge is the explicit mechanism that holds the §5.4 margin floor under worst-case abuse.**
2. **Per-conversation cost ceiling, enforced.** Hard caps in §4.1.1 (15 turns / 3 min voice / 25 min duration) are not soft suggestions — they're the budget guarantee. The runtime hard-stops at the cap.
3. **Hard cost-ceiling cut.** If a single conversation's *measured* COGS exceeds **$0.15** (instrumented at the agent worker, summed across LLM + voice + transport for that session), the runtime gracefully ends the session and counts it as 1 capped conversation. Catches the rare path where caching misses + Sonnet escalation + max voice all align. Logged for ops review.
4. **Haiku-default routing.** Text turns route to Haiku 4.5 by default; Sonnet 4.6 invoked only on tool-use turns and onboarding selector extraction. Engineering invariant — code review blocks any unconditional Sonnet call in chat path.
5. **Aggressive prompt caching** on both Haiku and Sonnet (system prompts cached at 90%+ hit rate). On Gemini Live, re-use voice persona system audio across sessions.
6. **Voice silence timeout** — Gemini Live session ends after 15s of visitor silence. No idle-listen drain.
7. **Bot filter at the edge** — UA + behavior heuristics drop scrapers before they hit a billable conversation. Lives in the gtag-side hello handshake, before any LLM call.
8. **Self-hosted TTS spike (Plan 4-bis)** — Coqui XTTS / Kokoro on a GPU pool. If quality holds for English/ES/FR, voice COGS drops 60-80%. Gemini Live stays as quality fallback for premium personas. This is the second-line defense if measured Gemini Live cost exceeds the $0.025/min assumption.

### 5.4 Margin floor commitment (engineering invariant)

**Hard floor: blended gross margin ≥ 75% on every billing period; worst-case GM ≥ 70% on every plan including surcharge revenue.**

This is not a forecast — it's an invariant that the runtime, billing, and pricing rules together must guarantee. The pieces that hold the floor:

- **Tightened per-conv caps** (§4.1.1) cap the worst-case COGS at $0.092.
- **Voice-fairness surcharge** (§5.3 #1) makes voice-abusing merchants pay their actual cost, scaled.
- **Hard cost-ceiling cut** (§5.3 #3) backstops cache misses and outlier paths.
- **Haiku-default routing** (§5.3 #4) keeps typical-blend GM in the 82-89% band.

**If measured GM drops below floor for a single billing period:** ops-channel page in Slack (#alerts-margin), automatic post-mortem RFC, no exec discretion to delay the fix. This is the line we don't cross — it's what makes the day-1-profitable claim defensible to investors and what keeps us from getting trapped in the negative-GM spiral that killed Inflection-style consumer AI.

**If measured Gemini Live cost exceeds $0.025/min:** the surcharge stays the same (because it's pegged to merchant abuse, not vendor cost), and we activate the §5.3 #8 self-hosted TTS spike. Worst case if both fail: prices up across the board — but the floor is non-negotiable, the prices are.

### 5.2 CAC & payback

| Channel | Expected CAC | Payback |
|---|---|---|
| Shopify App Store organic | ≈ $40 | <1 month |
| Content + SEO | ≈ $80 | <2 months |
| Paid (Google/Meta) | ≈ $250 | ≈ 8 months |
| Agency partner (rev share) | ≈ $0 upfront, 20% share | breakeven month 1 |
| Outbound (Wave 2 mid-market) | ≈ $1,200 | ≈ 14 months |

**Blended CAC payback target: < 8 months.** This is aggressive but achievable for PLG SaaS with > 80% margins.

### 5.3 Burn & runway

| Phase | Headcount | Monthly burn | MRR | Net burn |
|---|---|---|---|---|
| Months 0-6 (pre-revenue → $10K MRR) | 4 | $80K | $0 → $10K | -$75K avg |
| Months 7-12 ($10K → $150K MRR) | 8 | $180K | $50K avg | -$130K avg |
| Months 13-18 ($150K → $500K MRR) | 12 | $280K | $325K avg | +$45K avg ✅ |
| Months 19-24 ($500K → $850K MRR) | 16 | $380K | $700K avg | +$320K avg ✅ |

**Default-alive at month 14-15.** Seed $1.5M covers months 0-12 with cushion. Series A around month 18 at $4-6M ARR run rate.

---

## 6. Go-to-market

### 6.1 Distribution sequence

1. **Months 0-3 (now):** 10 design partners, hand-picked. Free for 6 months in exchange for case studies, conversion-lift data, public quotes, and call recordings.
2. **Month 4:** Shopify App Store launch + Product Hunt + HN. Goal: 50 paid merchants in first 30 days.
3. **Month 5-6:** Content engine (one technical post + one merchant case study weekly), SEO targeting "[platform] AI shopping assistant" long tail.
4. **Month 7-9:** WooCommerce.com listing, BigCommerce app marketplace, agency partner program.
5. **Month 10-12:** Outbound for mid-market ($5M-50M GMV) — small SDR team (1 human + agent stack). Enterprise tier announce.
6. **Month 13-18:** Geographic expansion (Wave 2), localization, Stripe Atlas-style entity for EU.

### 6.2 Pricing & packaging principles (DECISION)

- **No per-conversation pricing.** Rep AI loses on this — merchants hate the variable bill. We give a generous cap and overage at $0.005/conversation flat.
- **No free or trial tier.** Live demo on the landing page replaces both. Visitors play with a real copilot on a sample storefront, then sign up at $30. No expiring-credit funnel to optimize.
- **Annual = 20% off, paid upfront.** Cash + retention.
- **No "contact us" until $749/mo.** Self-serve up to Scale.

### 6.3 Channel mix (12-month)

| Channel | % of net-new MRR | Why |
|---|---|---|
| Shopify App Store organic | 35% | Defaultest distribution |
| Content/SEO | 20% | Compounds; cheapest CAC |
| Agency partners | 20% | Multi-merchant per deal |
| Paid acquisition | 15% | Scale knob, payback-controlled |
| WooCommerce / BigC marketplaces | 10% | Diversification |

---

## 7. 12-month roadmap (quarterly)

### Q2 2026 (May-Jul) — Foundation closes, design partners onboarded

- ✅ Plan 1 (foundation), Plan 2 (provisioning) — done
- 🟡 **Plan 3** (onboarding crawl + adapters: shopify, woo, magento, bigcommerce, wix, squarespace, dom-custom) — May
- **Plan 4** (gtag widget v1: PDP copilot, cart-add, multi-turn) — June
- **Plan 5** (WebSocket telemetry + merchant dashboard) — July
- **GTM:** 10 design partners signed; conversion-lift framework instrumented
- **Hiring:** founding eng #2, founding designer
- **Exit criteria:** 10 merchants live, ≥ 5% conversion lift demonstrated on 3+ merchants, < 100ms p95 widget mount

### Q3 2026 (Aug-Oct) — Public launch, $25K MRR

- **Plan 6:** Stripe billing, plan limits, dunning
- **Plan 7:** Self-serve onboarding flow (no white-glove)
- **Plan 8:** Vite/esbuild build pipeline + CDN
- **Plan 9:** Shopify App Store listing (full submission, theme review)
- **Launch:** Product Hunt, HN, Twitter, Indie Hackers
- **Hiring:** founding GTM (player-coach), founding ops
- **Exit criteria:** 200 paid merchants, $25K MRR, NPS ≥ 35

### Q4 2026 (Nov-Jan 2027) — Scale to $100K MRR

- **Plan 10:** WooCommerce listing
- **Plan 11:** BigCommerce listing
- **Plan 12:** A/B test add-on
- **Plan 13:** Theme-change auto-recheck add-on
- **Plan 14:** Agency partner portal + 20% rev share
- **Plan 15:** SOC 2 Type 1 + GDPR DPA self-serve
- **Hiring:** senior eng #3, content marketer, support eng
- **Exit criteria:** 700 merchants, $100K MRR, gross retention ≥ 92%, net retention ≥ 105%

### Q1 2027 (Feb-Apr) — Series A prep, $150K MRR, geographic prep

- **Plan 16:** Localization framework + DE/FR/ES live
- **Plan 17:** Enterprise tier (SSO, audit log, custom contracts)
- **Plan 18:** White-label / agency reseller tier
- **Plan 19:** Magento + Wix + Squarespace adapters at parity
- **Hiring:** VP Eng, VP GTM (or stay founder-led — TBD with board)
- **Exit criteria:** 1,000 merchants, $150K MRR, Series A term sheet in pocket

---

## 8. 24-month vision (months 13-24)

- **Marketplace play.** Third-party "skills" for shoppingmate copilot — sizing assistants, gift-finders, return-flow agents — each built by partners on a shoppingmate SDK and revenue-shared.
- **Vertical specializations.** Fashion (sizing + styling), beauty (shade-matching + skin), electronics (spec compare), food/grocery (substitution + dietary). Higher ARPU ($499+) per vertical.
- **API tier.** "shoppingmate without the widget" — brands building their own UI on our adapter + selector backbone.
- **Wave 3 geographies.** India, Brazil, Mexico, Indonesia, Vietnam at localized pricing tiers ($29-79).
- **Target month 24:** $850K MRR ($10M+ ARR run rate), 16 people, Series B optional not required.

---

## 9. CEO board meeting deck — slide-by-slide

Designed for a 30-minute slot (15 min present, 15 min discuss). Each slide has: **headline** + **what's on it** + **what you say**.

1. **Title — "shoppingmate: the cross-platform AI shopping copilot"**
   - Logo, date, attendees.
   - "Today: market, traction, ask. 15 minutes, then questions."

2. **The 60-second story**
   - One image: gtag snippet → 60s later → live AI copilot on PDP.
   - "We turn any e-commerce site into an AI-shopping site in 60 seconds. No app store, no theme edits, no SDK bloat. We work where Sidekick can't — on Woo, BigC, custom — which is 60% of the world."

3. **Why now (3 bullets, no more)**
   - LLM unit cost down 5-10× since 2024
   - Sidekick educated the market for us
   - Consumer agents (Operator/Rufus) are panicking brands into needing on-site AI

4. **The wedge**
   - 2×2 grid: x = single-platform → cross-platform, y = chat-shaped → commerce-shaped.
   - We're the only dot in upper-right quadrant.

5. **Traction**
   - Design-partner logos (anonymize until signed), conversion-lift chart, install time histogram (target: median < 90s).
   - "10 design partners, ≥ 5% lift on the 3 with statistical significance."

6. **Unit economics**
   - One number: 84% gross margin at Growth plan.
   - Payback: < 8 months blended.
   - Bridge from CAC to LTV:CAC ratio (target ≥ 4×).

7. **Competitive moat**
   - Selector cache as data moat.
   - Cross-platform breadth.
   - Thin-client architecture as enterprise trust story.

8. **12-month plan**
   - Single timeline graphic. Q2 → Q1 2027. Each quarter = 1 milestone, 1 risk, 1 measure.
   - $0 → $150K MRR.

9. **Capital ask**
   - $1.5M seed (or $3M for cushion + Wave 2 acceleration).
   - Use of funds: 65% eng, 20% GTM, 15% ops/legal/SOC2.
   - Runway: 18 months to default-alive.

10. **Risks & mitigations**
    - Sidekick goes cross-platform → cross-platform breadth + speed.
    - Operator-style disintermediation → become the merchant-side standard.
    - LLM cost regression → hedged with Haiku 4.5, prompt caching, model-router.

11. **Why this team**
    - Founder profile, technical edge, AI-native operations (Slack-as-OS reduces team size 3-4×).

12. **The ask + timeline**
    - "We want $1.5M at $12-15M post. Close by [date]. We've reserved [room] for $X from [lead]. Asking for diligence list today."

13. **Q&A backup slides** (don't show unless asked):
    - Detailed cohort retention
    - Per-platform adapter status
    - Hiring plan name-by-name
    - Composio MCP architecture
    - Security/SOC2 timeline

**Pre-meeting prep:**
- Send pre-read 48h before, 3 pages max: 1-pager + financial model + cap table.
- For each board member, predict their top concern; have a slide ready.
- Run it once with founding team night before. Time it.

---

## 10. Slack-as-OS — autonomous operations blueprint

### 10.1 Architecture

```
                       ┌─────────────────────────────────┐
                       │           Slack workspace        │
                       │  (single source of operational  │
                       │   truth — every signal lands here)│
                       └────────────┬────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
   ┌──────────▼────────┐  ┌─────────▼──────────┐  ┌──────▼─────────┐
   │  Scheduled agents │  │  Reactive agents    │  │ Slash commands │
   │  (cron triggers)  │  │  (webhook-driven)   │  │  (on-demand)   │
   └──────────┬────────┘  └─────────┬──────────┘  └──────┬─────────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
                       ┌────────────▼────────────────────┐
                       │   Claude Agent SDK (Sonnet 4.6) │
                       │   + MCP tool router             │
                       └────────────┬────────────────────┘
                                    │
       ┌────────────────┬───────────┼───────────┬──────────────────┐
       │                │           │           │                  │
   ┌───▼────┐      ┌────▼───┐  ┌────▼────┐  ┌───▼─────┐      ┌─────▼─────┐
   │Composio │      │Stripe  │  │ Linear  │  │ GitHub  │      │ Postgres  │
   │e-comm   │      │MCP     │  │  MCP    │  │  MCP    │      │ (analytics)│
   │(Shopify,│      │(billing,│  │ (eng)   │  │ (PRs)   │      └───────────┘
   │ Shippo, │      │dunning) │  └─────────┘  └─────────┘
   │ ...)    │      └────────┘
   └─────────┘
```

### 10.2 Channels and their purpose

| Channel | Purpose | Who/what posts | Human action |
|---|---|---|---|
| `#ops-revenue` | Daily MRR/churn/NRR digest 8am | Scheduled agent | Read, ack |
| `#ops-merchants` | New install / churned / at-risk events | Stripe + onboarding webhooks | Approve dunning, intervene at-risk |
| `#ops-billing` | Failed payments, refund requests, plan changes | Stripe webhook → reactive agent | Approve refunds > $100 |
| `#ops-incidents` | Production alerts, error spikes, degraded crawls | Sentry/Grafana → reactive agent | Acknowledge, fix |
| `#ops-support` | Triaged customer messages | Intercom/Front MCP → reactive agent | Approve auto-replies, take edge cases |
| `#hiring-pipeline` | New candidates sourced + screened | Sourcing agent | Approve outreach, decide screen |
| `#product-feedback` | NPS verbatims, feature requests, churn-reason text | Reactive agent | Tag, prioritize weekly |
| `#growth-content` | Drafted blog posts, social posts, ad copy | Scheduled agent | Approve/edit/reject |
| `#exec-decisions` | Material decisions requiring founder/board approval | Any agent | Decide |
| `#agent-feed` (audit) | Every agent action with link to reasoning | All agents | Spot-check daily |

### 10.3 Slash commands (DECISION — build these in Q3)

| Command | Action |
|---|---|
| `/merchant <id_or_domain>` | Full merchant card: plan, MRR, status, last conversation, churn risk, contact |
| `/metrics [day\|week\|month]` | KPI snapshot |
| `/churn-risk` | List of merchants with risk score > 0.6, with recommended action |
| `/hire <role> [seniority]` | Spawn hiring agent for new role |
| `/draft <topic>` | Content drafting agent |
| `/refund <merchant> <amount> <reason>` | Issue refund via Stripe MCP after approval |
| `/ship <plan_id>` | Trigger plan execution via Claude Agent SDK |
| `/standup` | Auto-generate standup from GitHub + Linear activity |

### 10.4 Scheduled agents (cron)

| Cron | Job | Output |
|---|---|---|
| Daily 8am | Revenue digest | `#ops-revenue` post |
| Daily 8am | Churn risk recompute | `#ops-merchants` summary |
| Daily 9am | Sales pipeline freshness check | `#growth-content` if stale |
| Weekly Mon 9am | Cohort retention + LTV update | `#ops-revenue` thread |
| Weekly Mon 10am | Hiring pipeline status | `#hiring-pipeline` |
| Weekly Fri 4pm | Auto-drafted weekly investor update | `#exec-decisions` for founder approval |
| Monthly 1st | Auto-drafted board update | `#exec-decisions` |
| Hourly | Crawl-failure scan | `#ops-incidents` if anomaly |

### 10.5 Reactive agents (event-driven)

| Trigger | Agent | Default action |
|---|---|---|
| Stripe `payment_failed` | Dunning agent | Email, Slack DM merchant, schedule retry |
| Stripe `subscription_canceled` | Churn agent | Auto-trigger exit-survey email; create Linear ticket if reason ∈ bug list |
| Onboarding job fail (3rd attempt) | Recovery agent | Page on-call eng if custom-DOM; auto-retry if API |
| GitHub PR opened | Review agent | Run security-review skill; post summary |
| Intercom message inbound | Support agent | Triage → auto-reply (low-conf to human) |
| New merchant install | Welcome agent | Personalized welcome email + setup-call CTA |

### 10.6 MCP toolkit map

**From Composio (e-commerce + adjacent):**

| Toolkit | Used for |
|---|---|
| **Shopify** | Read products/orders/inventory; sync metafields for selector hints; trigger Shopify Admin actions |
| **ShipEngine / Shippo / Shipday** | Optional: shipping-rate-aware shopping conversations ("when will it arrive?") |
| **FraudLabs Pro** | Risk-score traffic for enterprise tier |
| **Lemon Squeezy** | (alternate billing for non-card geos in Wave 3) |
| **Gumroad / Payhip** | Long-tail digital-goods adapters |
| **BTCPay Server** | Crypto-paying merchants (small but loyal) |

**Gaps not covered by Composio's e-commerce category — we build/source separately:**

| Need | Source |
|---|---|
| WooCommerce REST API | Build internal MCP from REST API (Plan 11) |
| BigCommerce API | Build internal MCP (Plan 11) |
| Magento 2 API | Build internal MCP (Plan 19) |
| Wix Stores API | Build internal MCP (Plan 19) |
| Squarespace Commerce | Build internal MCP (Plan 19) |
| **Stripe** (billing) | Use official Stripe MCP, not Composio's e-comm category |
| **Linear** (eng) | Linear MCP |
| **GitHub** | GitHub MCP |
| **Greenhouse / Ashby** (ATS) | Ashby MCP if exists; else build |
| **Cal.com / Calendly** (scheduling) | Cal.com MCP |
| **Resend** (email) | Resend MCP |
| **Attio / HubSpot** (CRM) | Attio MCP |
| **Postgres analytics** | Read-replica MCP, query-only role |
| **Sentry / Grafana** | Sentry MCP |

**DECISION.** We use Composio for what it covers well (Shopify, shipping, fraud) and build minimal internal MCP servers for the platform APIs that are core to our adapter portfolio. Building our own keeps us off the dependency hook for our most sensitive integrations.

---

## 11. Hiring agent automation

### 11.1 Pipeline stages (all agent-driven, human approves at gates)

1. **Intake** — `/hire founding-pm` in Slack. Agent asks: seniority, budget, must-haves. Drafts JD. Posts to `#exec-decisions` for founder approval.
2. **Publish** — Agent publishes to: Ashby (or Workable), LinkedIn, Hacker News "Who's hiring", Wellfound, founder's Twitter, niche communities. Tracks views.
3. **Source** — Sourcing agent searches LinkedIn + GitHub + Wellfound (via Composio/Apollo MCP if available, else Apify scraper + LinkedIn API). Scores candidates against JD. Posts top 10/week to `#hiring-pipeline`.
4. **Outreach** — Founder thumbs-up names → outreach agent drafts personalized DM/email. Founder approves text. Sent via LinkedIn/Resend.
5. **Screen** — Replies route back to channel. Scheduling agent books 30-min screen via Cal.com link. Pre-call brief auto-generated and DM'd to founder 30 min before.
6. **Take-home / pairing** — Agent emails task with deadline. Reviews submission against rubric. Suggests pass/fail to founder.
7. **Onsite** — Agent books panel, generates per-interviewer rubric, reminds panel, collects scorecards, computes hire/no-hire signal.
8. **Offer** — Agent drafts offer letter from comp template, sends via DocuSign MCP. Tracks status.
9. **Reference checks** — Agent emails references with structured questions, summarizes responses.
10. **Onboarding** — Day 1: agent provisions accounts (GitHub, Linear, Slack, Notion, Ashby), sends welcome packet, books 1:1s for first 2 weeks.

### 11.2 Default first 5 hires (by month 9)

| Role | Why | Comp band |
|---|---|---|
| Founding eng #2 (full-stack/backend) | Plan 3-5 velocity | $160-200K + 1.5-3% |
| Founding designer | Widget UX + dashboard + brand | $150-180K + 0.7-1.5% |
| Founding GTM (player-coach) | App store + content + first sales | $140-180K + 1-2% |
| Founding ops/finance | Slack-as-OS owner, BizOps automations | $120-160K + 0.5-1% |
| Senior eng #3 (frontend/widget) | Bundle perf, A/B framework | $170-210K + 0.5-1% |

### 11.3 Human-in-loop guardrails (DECISION)

- Never auto-send outreach. Founder approves every name + every message until month 12.
- Never auto-make offers. Always founder + one other human.
- Reference checks: agent drafts questions, *human* makes the call (legal exposure).
- Background checks: human-handled via Checkr.

---

## 12. Documentation operating model

### 12.1 Internal docs (in repo)

| Type | Location | Trigger | Owner |
|---|---|---|---|
| **ADR** (Architecture Decision Record) | `docs/adr/YYYY-MM-DD-title.md` | Any decision affecting > 1 module | Author |
| **RFC** (Request For Comment) | `docs/rfc/NNNN-title.md` | Cross-team design needing input | Author |
| **Runbook** | `docs/runbooks/<scenario>.md` | Any new on-call scenario | On-call eng |
| **Plan** | `docs/superpowers/plans/...` | Multi-step implementation work | (current convention) |
| **Spec** | `docs/superpowers/specs/...` | Product/system design | (current convention) |
| **Postmortem** | `docs/postmortems/YYYY-MM-DD-title.md` | Any sev1/sev2 incident | Incident commander |
| **Strategy** | `docs/strategy/...` | Quarterly + major pivots | Founder/CEO |

### 12.2 Customer-facing docs

- **docs.shoppingmate.com** — Mintlify or Docusaurus hosted on Vercel. Content in repo at `docs/public/`.
- **Auto-generated install playbook per merchant** — On signup, agent generates a personalized "install on [Shopify/Woo/etc]" page with merchant's domain pre-filled.
- **Status page** — `status.shoppingmate.com` via Better Stack or BetterUptime, auto-updated from health checks.
- **Changelog** — `changelog.shoppingmate.com`, auto-drafted from Linear "shipped" tickets, weekly publish.

### 12.3 Doc automation rules (DECISION)

- Every PR > 100 LOC must update or create one doc (ADR or runbook). CI checks and warns.
- Every Linear ticket marked "shipped" → agent drafts changelog entry, posted to `#growth-content` for approval.
- Every merged ADR → linked from the relevant module's `README.md` automatically.
- Postmortem within 48h of any sev1/sev2; agent drafts from incident channel transcript.

### 12.4 Knowledge graph

Run the `graphify` skill weekly across `docs/` to keep a living knowledge graph of strategy → spec → plan → code → runbook. Surfaces orphans (plans without specs, code without docs).

---

## 13. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shopify Sidekick goes cross-platform | Medium | High | Cross-platform breadth + speed; partnership outreach to Shopify before Q4 |
| Operator/Computer Use disintermediates on-site experience | Medium | High | Position as merchant-side standard; expose `shoppingmate.json` agent manifest; partner with Anthropic/OpenAI |
| LLM cost regression (vendor price hike) | Low-medium | Medium | Multi-model router (Anthropic + fallback); aggressive prompt caching; cap conversation length |
| **LLM stack fragmentation** (Anthropic for text + tool-use, Gemini for voice) | Medium | Medium | Conscious trade: native realtime audio cost/latency outweighs single-vendor consistency. Mitigate with: shared session-context bridge (text history → voice agent system prompt), unified safety-prompt template, single tool-call schema both sides honor. Revisit if Anthropic ships Live API equivalent. |
| **Gemini Live policy / pricing change** (Google can re-tier or restrict) | Low-medium | Medium | Self-hosted TTS spike (Plan 4-bis) keeps an exit ramp; LiveKit transport stays decoupled from voice model so we can swap voice provider without re-doing the media plane |
| Selector extraction quality on long-tail custom sites | Medium | Medium | Synthetic cart-add validation gate; human-review queue for < 70% confidence; per-merchant quality dashboard |
| Privacy/cookie regulation tightens (esp. EU) | Medium | Medium | Own telemetry, no third-party SDK, server-side identity only, GDPR DPA standard |
| Founder capacity (you can't be in every channel) | High | Medium | Slack-as-OS is the answer — but still real. Hire founding ops by month 6, not month 9, if Slack noise hits 200 threads/day |
| Series A market closes 2027 | Medium | Medium | Default-alive by month 14-15 makes Series A optional |

---

## 14. Decisions I made for you (challenge any of these)

1. ✅ ~~Pricing: $99 / $249 / $749 / Enterprise — no per-conversation billing.~~ **REVERSED 2026-05-01:** consumption pricing, $30 / $99 / $299 / $799 / Enterprise, priced per **conversation** (one visitor session). Voice included in every plan; per-conversation hard caps prevent runaway cost. Top-up packs ($19/$59/$199/$799) + opt-in auto-recharge instead of overage billing. Day-1 profitable — every plan GM-positive even at worst-case per-conversation cost. See §4 / §5 / §14 decisions 15-18.
2. ✅ ~~No free tier — 14-day trial only.~~ **REVISED 2026-05-01:** No trial tier at all. Live demo on shoppingmate.ai landing page is the trial — visitors interact with a real copilot on a sample storefront. Signup goes directly to Starter $30. Day-1 paid; no expiring-credit funnel.
3. ✅ Wave 3 (India/Brazil/etc) starts month 13, not earlier.
4. ✅ Build internal MCP for Woo/BigC/Magento/Wix/Squarespace; use Composio for Shopify + shipping + fraud.
5. ✅ Slack is the OS — every operational signal lands there before any other tool.
6. ✅ First 5 hires: founding eng #2, designer, GTM, ops, senior eng #3.
7. ✅ $1.5M seed target (cushion to $3M); Series A around month 18.
8. ✅ Annual pricing 20% discount; no enterprise gating below $749.
9. ✅ Self-build A/B test runner as a paid add-on ($49/mo) rather than free.
10. ✅ Marketplace play (third-party skills) deferred to month 18+, not Q1 2027.
11. ✅ **Voice transport: LiveKit Agents (WebRTC)** instead of self-built voice gateway over raw WebSockets. Lazy-loaded WebRTC client so text-only widget mount stays under 14KB.
12. ✅ **Voice model: Gemini 2.5 Flash Live native audio** for the speaking turn (founder accepted hybrid stack). Anthropic Sonnet/Haiku stays for text + tool-use + onboarding selector extraction. Trade-off (LLM stack fragmentation) accepted; mitigations in §13.
13. ✅ Voice priced via per-plan minute caps (500 / 2,000 / 8,000) + $0.15/min overage + $79 voice-min add-on packs. Brand-tuned voice persona is the $99/mo upsell; the underlying voice itself is core, not optional.
14. ✅ Self-hosted TTS spike (Coqui/Kokoro on GPU pool) is a Plan 4-bis side-quest to de-risk Gemini Live cost, not a v0.1 dependency.
15. ✅ **Pricing pivot (2026-05-01):** flat tiers replaced with **consumption pricing per conversation**. $30 / $99 / $299 / $799 / Enterprise. Voice included; no separate voice cap. Day-1 profitable mandate — every tier GM-positive at worst case (with §5.3 guardrails enforced).
16. ✅ **Top-up packs** (50/200/1,000/5,000 conversations at $19/$59/$199/$799). Never expire; carry forward. Replaces overage billing.
17. ✅ **Auto-recharge** is opt-in per merchant (threshold + pack size in dashboard). Hard cap of 3 auto-recharges per billing period before merchant must approve manually.
18. ✅ ~~**Per-conversation hard caps** are non-negotiable — 20 turns / 5 min voice / 30 min duration. Plus voice-fairness surcharge ($0.05/voice-conv above 40% voice ratio).~~ **REVISED 2026-05-01 (decision #19):** caps tightened to **15 turns / 3 min voice / 25 min duration**; voice-fairness surcharge raised to **$0.30/voice-conv above 20% voice ratio**. These together with the §5.4 floor commitment hold the margin guarantee.
19. ✅ **Margin floor invariant (2026-05-01).** Blended GM ≥ 75% / worst-case GM ≥ 70% on every plan. Held by: tightened caps (§4.1.1), Haiku-default routing (§5.3 #4), voice-fairness surcharge at 20%/$0.30 (§5.3 #1), hard $0.15 per-conv cost-cut (§5.3 #3). Slack #alerts-margin pages on any breach; no exec override. Self-hosted TTS spike is the second-line defense if Gemini Live pilot shows >$0.025/min. See §5.4.

---

## 15. What I need from you (next 7 days)

- **Reverse any decisions in §14** that you disagree with — write "no" + rationale, send back.
- **Confirm seed target** — $1.5M or $3M?
- **Approve first 2 hires to begin sourcing** (founding eng #2, founding designer recommended).
- **Pick board cadence** — monthly or 6-weekly. Default monthly first 6 mo, then 6-weekly.
- **Pick Slack workspace** — new dedicated `shoppingmate-ops.slack.com`, or extend existing? Default: new.
- **Greenlight Plan 3 kickoff** — onboarding crawl + adapters. Already designed; awaits go.

---

*This document is a living strategy v0.1. Iterate on each section in its own doc once we've agreed direction. Next dependent docs: `docs/strategy/2026-05-01-board-deck-v1.md` (slides as Keynote/Pitch), `docs/strategy/2026-05-01-financial-model.xlsx` (numbers we can pressure-test), `docs/strategy/2026-05-01-slack-os-implementation-plan.md` (tooling-level plan).*
