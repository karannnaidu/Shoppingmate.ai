# shoppingmate — Viability Analysis v0.1

**Date:** 2026-05-01
**Purpose:** Pressure-test the strategy in `2026-05-01-shoppingmate-strategy.md` across 10 viability dimensions before any seed-round commitment. Honest verdicts, not cheerleading.

**Verdict legend:**
- 🟢 **GREEN** — viable on current evidence
- 🟡 **YELLOW** — viable with named mitigations
- 🔴 **RED** — showstopper unless resolved before scaling spend

---

## Bottom line first

**Verdict: 🟢 viable, with 5 yellows (no red) — margin floor mandate cleared the load-bearing risk.**

**Updated 2026-05-01:** Founder mandated a 70-80% gross-margin floor as a hard invariant. Strategy doc §5.4 codifies this. Per-conv caps tightened (15 turns / 3 min voice / 25 min), text routes Haiku-default, voice-fairness surcharge raised to $0.30/voice-conv above 20% ratio, hard $0.15 per-conv cost-cut backstops outliers. Worst-case GM at 100% voice abuse with surcharge: Starter 75% / Growth 76% / Scale 75% / Pro 70% — all clear the floor. **The RED on Gemini Live cost downgrades to YELLOW** because the floor is now mechanism-enforced (surcharge + cost-cut), not assumption-dependent.

The 5 yellows are:
1. Gemini Live cost still unverified — pilot needed for typical-blend GM confidence (was RED, now YELLOW)
2. Selector-extraction quality on long-tail custom storefronts
3. Sidekick-going-cross-platform timing
4. Demo-store-as-conversion-engine maturity (Plan 4 dependency)
5. Founder bandwidth as Slack-as-OS owner pre-month-6

Each has a defined kill-switch — discussed below.

---

## 1. Technical viability — 🟢 GREEN

**Question: Can we build it with this team, on this stack, in 12 months?**

**Evidence:**
- Plans 1+2 shipped in <30 days (foundation + provisioning + safety check + onboarding handler skeleton). Memory `project_shoppingmate_phase1_status.md` confirms 66/66 tests across 14 files; no architectural rework needed.
- Stack choices (TS monorepo, Postgres, Drizzle, BullMQ, Hono, MinIO, Vitest, Biome) are all mature. No exotic dependencies.
- Vision-grounded selector extraction is a known pattern (Multi-On, Adept, Browserbase have shipped similar). Not bleeding-edge.

**Risks:**
- Plan 3 (onboarding crawl + 6 platform adapters) is the largest single Plan in the roadmap. Realistic estimate: 4-6 weeks, not the 4 weeks implied.
- LiveKit + Gemini Live integration is new territory for the team — add 2-week learning tax.

**Mitigations in place:** plan-driven workflow with subagent-parallelism for adapter implementation; Plan 3 can scope-cut to Shopify+Woo+custom-DOM at launch and ship Magento/BigC/Wix/Squarespace as Plan 19 catch-up.

---

## 2. Market viability — 🟢 GREEN

**Question: Is there real demand at $30-799/mo for this category, on this stack?**

**Evidence:**
- Tidio (~300K paying merchants), Rep AI, Octane, Manifest all have proven SMB e-comm pays for AI assistants in this band.
- Sidekick has done category education for free.
- 14M global stores in TAM, 3.2M SAM (English, > $100K GMV).

**Risks:**
- *Validation of cross-platform demand specifically* — the market is dominated by Shopify-native plays. We're betting the long tail (Woo, BigC, custom) is real and willing to pay. Not yet proven; depends on design-partner mix.

**Mitigations in place:** §6 GTM specifies design-partner cohort must include ≥ 4 non-Shopify (Woo + custom) before public launch. If those merchants don't convert at parity to Shopify ones, we have a problem and pivot to Shopify-first.

---

## 3. Unit-economics viability — 🟡 YELLOW (margin floor enforced; Gemini Live cost still unverified)

**Question: Does each plan really make money? Is the worst case bounded?**

**Evidence (revised 2026-05-01 after margin floor mandate):**
- Strategy §5.4 declares a hard invariant: **blended GM ≥ 75%, worst-case GM ≥ 70%** on every plan including surcharge revenue. Backed by four reinforcing mechanisms.
- §5.1 worst-case ceiling dropped from $0.235 → **$0.092** via tightened caps (15 turns / 3 min voice / 25 min) + Haiku-default text routing.
- §5.2 worst-case table (100% voice abuse + surcharge active) shows all plans clear 70%: Starter 75%, Growth 76%, Scale 75%, Pro 70%.
- §5.2 typical-blend table (10% voice, no surcharge) shows 82-89% across plans.
- §5.3 #3 hard cost-cut at $0.15/conv backstops cache misses + Sonnet escalation outliers.

**Risks:**
- 🟡 **Gemini Live cost is unverified at production scale.** The $0.025/min rate is still an estimate. If actual is 2× ($0.05/min), worst-case per-conv goes from $0.092 to ~$0.17, breaching the §5.3 #3 hard cost ceiling and forcing the runtime to cut sessions earlier. Floor still holds via the surcharge, but visitor experience degrades on long voice sessions. Downgraded from RED to YELLOW because the floor is now mechanism-enforced, not assumption-dependent.
- 🟡 Voice-fairness surcharge ($0.30/voice-conv above 20%) is untested at this rate. Merchants may push back ("$0.30 sounds high"). Disclosure copy on signup + dashboard pre-bill alerts critical.
- 🟡 Bot filter at the edge — if bots leak through and burn merchant credits, support load + refunds will eat margin even before COGS.
- 🟡 **Engineering invariant risk.** Haiku-default routing relies on code review discipline — one unconditional Sonnet call in chat path breaks the typical-blend GM. Mitigation: lint rule + CI check that blocks `model: 'sonnet'` in chat handler files.

**Mitigations:**
- 🟡 **Gemini Live pricing pilot (still required before seed close).** 100-conversation production test on a real merchant. Now informational rather than blocking — confirms the typical-blend GM band, but doesn't gate the floor. If $/min > $0.025, activate self-hosted TTS spike (§5.3 #8).
- 🟡 Voice-fairness surcharge: merchant disclosure on signup, dashboard pre-bill alerts at 50%/80%/100% of threshold, optional auto-cap (merchant can opt to block voice above 20% rather than pay surcharge).
- 🟡 Bot filter spec: UA + behavior + visitor-fingerprint heuristics, false-positive rate < 0.1%, lives in gtag-side hello handshake. Plan 4 dependency.
- 🟡 Slack #alerts-margin auto-page on any billing period below floor. No exec override.

---

## 4. GTM viability — 🟡 YELLOW

**Question: Can we acquire customers at projected CAC payback < 8 months?**

**Evidence:**
- Shopify App Store organic CAC ~$40 with day-1 paid conversion (no trial) → payback in week 2. ✅
- Content + SEO at $80 CAC payback < 2 months. ✅
- Paid (Google/Meta) at $250 CAC payback ~8 months — barely viable, depends on conversion rate of landing-page demo.

**Risks:**
- **Landing-page demo is now mission-critical.** Without a trial tier, the demo IS the conversion engine. If the demo doesn't work (latency, breaks, looks janky on mobile), conversion craters. Not yet built.
- Shopify App Store approval timing — historically 1-3 weeks. We've assumed 0-week launch. If Shopify rejects v1 for any reason, GTM slips a month.
- The 1,900-paying-merchants-by-month-12 target is aggressive. Tidio took 3+ years to hit similar numbers. We're betting on AI commerce timing + lower price point + cross-platform breadth — not impossible but precedent-light.

**Mitigations:**
- 🟡 **Demo store is a Plan 4 hard dependency**, not a Plan 7 marketing afterthought. Demo store with persistent state reset, real catalog, mobile-tested. Sample storefront brand built into Plan 4 spec.
- 🟡 Submit to Shopify App Store in parallel with Plan 9 build, not after. Aim for review by month 4.
- 🟡 If month-6 merchant count is < 100, reset projection and extend runway plan (or accelerate seed close with cushion → $3M).

---

## 5. Operational viability — 🟡 YELLOW

**Question: Can 4 → 16 people run this with the Slack-as-OS architecture?**

**Evidence:**
- Slack-as-OS architecture (§10) is well-specified but **never proven at this scale by us**. Other companies have done it (Doist, Buffer, Levels) but with different products.
- 30 Composio toolkits + 5 internal MCPs + Claude Agent SDK is a large surface area for a 4-person team to maintain.

**Risks:**
- Founder bandwidth in months 0-6. Strategy doc §13 notes: "if Slack noise hits 200 threads/day, hire founding ops by month 6, not month 9." Likely to happen earlier than planned.
- Agent-feed channel signal-to-noise ratio. Unclear how much of #ops-incidents is genuine vs. agent thrash.
- MCP integration debt — every new platform we onboard adds an MCP server we have to keep working through their API churn. Linear cost over time.

**Mitigations:**
- 🟡 **Hire founding ops at month 4-5**, not 9. Drop senior eng #3 to month 9 to fund this.
- 🟡 Define agent-feed signal/noise SLO: < 50 actionable alerts/week per agent type. Tune cron + reactive triggers monthly.
- 🟡 MCP server monitoring: track integration uptime per platform, alert when SLA drops below 99% so we know which one to invest in.

---

## 6. Capital viability — 🟢 GREEN

**Question: Does $1.5M actually get us to default-alive?**

**Evidence:**
- §5.3 burn model: months 0-12 net burn ~$1.0M against $1.5M seed = $500K cushion. Reasonable.
- Default-alive at month 14-15 is consistent with $150K MRR by month 12 and 75-80% margin.
- Series A around month 18 at $4-6M ARR run rate is in market for AI-commerce SaaS at this stage (multiples of 30-50× ARR for top quartile).

**Risks:**
- If month-12 MRR is $75K instead of $150K (50% miss), runway extends to month 18 — still alive but raises Series A risk.
- If Gemini Live cost is 2× our estimate (RED risk above), gross margin drops 10pts, default-alive slips to month 18-20.

**Mitigations:** raise $3M instead of $1.5M if Gemini Live pilot data is uncertain by close. Cushion outweighs dilution cost at this stage.

---

## 7. Regulatory / legal viability — 🟡 YELLOW

**Question: Are we in clear water on privacy, payments, agent liability?**

**Evidence:**
- Own telemetry, no third-party visitor SDK → GDPR/CCPA much cleaner than competitors.
- Stripe handles payments compliance.
- Plan 15 (SOC 2 Type 1) is on the roadmap by Q4.

**Risks:**
- 🟡 **EU AI Act** (in force Aug 2026) — voice-driven commerce conversations may qualify as "high-risk" under Article 6 if they "substantially influence purchasing decisions." TBD on enforcement; legal review needed before EU expansion.
- 🟡 **Selector cache scraping** — extracting selectors from a merchant's site is *with permission* (they install our gtag), but we should have explicit ToS clauses covering re-crawl behavior and selector cache ownership. Currently undefined.
- 🟡 **Agent-driven transaction liability** — if our copilot recommends a product that's out of stock or mispriced and the visitor purchases, who's liable? Spec already prevents price hallucination but stock-out is unresolved.
- 🟡 **Voice consent** — recording voice for QA (7d retention per spec) requires explicit visitor consent in EU/CA/some US states. Currently in spec but not in widget UI.

**Mitigations:**
- Engage EU AI Act counsel by month 9 (before Wave 2 expansion).
- Draft merchant ToS by month 4 with selector-cache + re-crawl clauses.
- Stock-out handling: Plan 5 must include real-time stock check before any "add to cart" recommendation.
- Voice consent UI: Plan 4 must include explicit "voice on" toggle with consent string.

---

## 8. Technology risk — 🟡 YELLOW

**Question: Are we vulnerable to vendor moves we can't survive?**

**Risks ranked:**
- 🟡 **Gemini Live policy/pricing change.** Mitigation: self-hosted TTS spike (Plan 4-bis) is the exit ramp. Build it in Q3, not Q4.
- 🟡 **Anthropic API price hike.** Currently aggressive prompt caching + Haiku for chat keeps us insulated; multi-model fallback (Sonnet → Haiku → smaller open model) is engineered into the LLM router from day one.
- 🟢 **LiveKit lock-in.** Open source, self-hostable. Not a concern.
- 🟢 **Stripe** — industry standard, not a concentration risk.

---

## 9. Competitive viability — 🟡 YELLOW (one RED scenario)

**Question: Can we hold the wedge against well-capitalized incumbents?**

**Evidence:**
- Cross-platform breadth + selector cache moat = real differentiation.
- 12-18 month catch-up cost for any new entrant.

**Risks:**
- 🔴 **Sidekick-goes-cross-platform** scenario. If Shopify announces support for Woo/BigC/etc. via Sidekick (they own the merchant relationship via Hydrogen, Shop Pay, etc.), our wedge collapses overnight. **Mitigation:** ship cross-platform within 9 months and own non-Shopify merchant relationships. Pre-empt with ≥ 2 Woo + 2 BigC marquee logos by month 6.
- 🟡 **Operator/Rufus disintermediation** — Phase 2 MCP play is the answer. Build it before consumer agents commodify the merchant frontend.
- 🟡 **Klaviyo / Attentive bundling** — they could ship a copilot in 2026-2027. Outreach for partnership before they decide to build.

---

## 10. Team viability — 🟢 GREEN (assumes founder profile)

**Question: Can we hire the right 5 people in 9 months?**

**Evidence:**
- Founding eng #2 + designer + GTM + ops + senior eng #3 are well-defined roles, market-rate comps, narrow enough job specs to source.
- Hiring agent automation (§11) is a real productivity multiplier vs. typical 5-month hiring cycles.

**Risks:**
- AI-commerce is hot — top candidates have multiple offers. We may need higher equity than the §11 ranges suggest.
- Hiring agent loop is unproven. If outreach response rates < 5%, founder spends 30%+ time on hiring instead of product.

**Mitigations:** equity bands flexible up 50% on top 20% of candidates. Quarterly hiring-loop review at 90 days.

---

## Top 5 risks (ranked by P × I)

| # | Risk | Probability | Impact | Mitigation owner |
|---|---|---|---|---|
| 1 | Gemini Live cost is materially higher than $0.025/min | Medium | High | **Pilot before seed close** (Plan 3-bis) |
| 2 | Sidekick goes cross-platform in 2026-2027 | Medium-Low | Catastrophic | Ship cross-platform fast; lock in non-Shopify logos by month 6 |
| 3 | Landing-page demo doesn't convert at projected rate | Medium | High | Plan 4 hard dependency; A/B test from day 1 |
| 4 | Founder bandwidth saturates before founding ops hire | High | Medium | Pull founding ops hire to month 4-5 |
| 5 | EU AI Act enforcement hits voice commerce | Low-Medium | Medium-High | Legal review month 9, before Wave 2 |

---

## Pre-seed-close blockers (must resolve before signing term sheet)

1. **Gemini Live pricing pilot** with 100 production conversations on a real merchant. Measured $/conv with 95% CI. Update strategy §5 numbers.
2. **Demo-store spec** at `docs/superpowers/specs/2026-05-XX-demo-store.md`. What it sells, persistent-state reset model, mobile parity check.
3. **2 design-partner LOIs** — one Shopify, one non-Shopify. Signed letters of intent (free for 6mo, will provide case study + lift data) prove demand at the price points.
4. **Legal review of merchant ToS draft** — selector cache, re-crawl, voice consent, agent liability for stock-out. Not full SOC 2 yet — just baseline.

---

## Final verdict

**Proceed.** The wedge is real, the team has shown it can ship, and the unit economics work after the §5.3 guardrails clear. The one RED — Gemini Live cost — is empirical and resolvable in 1-2 weeks with a pilot. If the pilot confirms our estimate (or stays within 1.5× of it), the path is clear. If not, the response is a tier reprice + self-hosted TTS pull-in to Plan 4, not a strategy abandonment.

**Don't proceed if any of these become true** by month 6:
- Gemini Live measured cost is > 2× estimate AND self-hosted TTS quality fails
- Sidekick announces cross-platform support before our public launch
- < 50 paying merchants AND < 10% week-over-week growth from month 4

Reassess strategy at end of Q3 2026 with measured data.
