# shoppingmate — Go-To-Market Plan (International, Shopify-first)

**Date:** 2026-06-12
**Owner:** Karan (solo founder)
**Status:** Active plan — revenue is the priority. No external cash; goal is first revenue → fund coding interns.

---

## TL;DR

Sell shoppingmate as a **premium AI shopping concierge to international wellness/DTC brands on Shopify.** Use **Calmosis as the live proof brand** (we own the repo → flawless add-to-cart, real conversion-lift number). Land 1–2 international "lighthouse" logos for relatable proof, then run a high-touch, account-based sales motion at full price.

- **Base case:** ~$20–25k MRR (~$240–300k ARR) by month 12.
- **Optimistic:** $45–60k MRR (~$540–720k ARR) with a few Shopify Plus accounts + App Store inbound.
- **First hire fundable from logos #1–2** (one client ≈ 2–4 intern stipends).

**The whole plan is gated by one thing:** a real, provable conversion lift on a live store. No proof number → no case study → no premium sales.

---

## 1. Where we are (honest status)

- Product is **broad but was shallow**: voice, multilingual, personas, 6 platform adapters — but the core "assistant that *acts*" was faked/broken on the one live client.
- Fixed in this cycle (deployed): voice no longer speaks tool syntax; cart-add no longer fakes success; price card triggers; the voice side-channel now gets brand KB + site map. See `project_voice_bot_fixes_2026-06-08`.
- **Still true:** zero external paying customers; reliable transactional only exists where there's a real API (Shopify/Woo) or a brand-side endpoint we control (Calmosis).

**Strategic error to stop repeating:** building breadth before depth, and shipping without an end-to-end "can a real person actually buy through this?" gate.

---

## 2. Strategy

**Shopify-first. International. Premium. Wellness/DTC beachhead.**

- **Shopify only** for paid customers → native Cart/Storefront API = reliable add-to-cart + checkout handoff. No fragile DOM-driving. Sidestep the entire custom-site reliability problem.
- **International** (US/UK/EU/AU) → 7–10x the ACV of Indian SMBs; one logo funds a hire.
- **Wellness / supplement / beauty, considered-purchase, high-AOV** → buyers ask real questions (ingredients, suitability, dosage) before buying, so a concierge that *answers well* drives measurable lift. This is our wedge vs. generic chatbots, and our Calmosis domain knowledge transfers.

**What we do NOT do now:**
- No Indian-SMB low-ACV grind.
- No universal custom-site transactional engine (tar pit).
- No building "OpenKarta" as an open *standard* — the agentic-commerce standard war is owned by giants (Shopify UCP, OpenAI/Stripe ACP, Google AP2). We *implement on top of* those; we don't invent a competing one. Park OpenKarta as a future brand/moat.

**Checkout always stays on the brand's domain.** We never host payment (PCI/trust/liability). We build the cart (API or brand endpoint), then redirect to their native checkout pre-filled.

---

## 3. Positioning / wedge

> "A premium AI sales concierge for wellness DTC that answers buyers' real questions and lifts conversion — measurably."

Sell **outcomes, not features**: assisted conversion lift, higher AOV, recovered carts. The dashboard line "we added $X of assisted revenue last month" is both the pitch and the retention hook.

---

## 4. ICP

- Platform: **Shopify** (detectable; native API path).
- Vertical: wellness / supplements / beauty / considered-purchase DTC.
- Traffic: enough that a lift shows in 2–4 weeks.
- AOV: high enough that a few % conversion lift = real money.
- Geo: US / UK / EU / AU.

Target list: **50–100 hand-picked brands** to start.

---

## 5. Pricing (premium — no freemium race to the bottom)

| Tier | Price | For |
|---|---|---|
| Growth | $299/mo | smaller DTC |
| Pro | $799/mo | scaling DTC |
| Plus | $1,500–3,000/mo | Shopify Plus / mid-market |
| Voice | usage-priced add-on | premium differentiator (protects margin) |

- Anchor price on value (fraction of assisted-revenue lift); consider base + % of assisted revenue for big stores.
- **Annual / quarterly contracts** → cash upfront + lower churn.
- Blended ARPU: **~$500 early → ~$650+** as mid-market mix grows.
- Keep voice usage-priced — Gemini Live cost is the margin risk. Target ~75% gross margin (text-heavy).

---

## 6. Revenue model — MOM (base case)

| Month | New logos | Total | MRR ($) | ARR run-rate |
|---|---|---|---|---|
| M1 | 1 | 1 | 500 | $6k |
| M2 | 2 | 3 | 1,500 | $18k |
| M3 | 2 | 5 | 2,500 | $30k |
| M4 | 3 | 8 | 4,000 | $48k |
| M6 | — | ~14 | ~7,250 | ~$87k |
| M9 | — | ~26 | ~13,000 | ~$156k |
| M12 | — | ~38 | ~19,000–23,000 | **~$230–275k** |

**Assumptions:** ARPU ~$500 (drifting to ~$650), churn ~5%/mo, solo founder-led sales + App Store organic from ~M3.

### Scenario bands (M12)

| Scenario | M12 MRR | M12 ARR | Logos |
|---|---|---|---|
| Conservative (trust gap slows first 4 mo) | ~$9–11k | ~$110–130k | ~20 |
| **Base** | **~$20–25k** | **~$240–300k** | ~35–40 |
| Optimistic (Plus whales + App Store inbound, ARPU ~$900) | ~$45–60k | ~$540–720k | ~50 + whales |

**Intern funding:** one $500–1,000/mo client ≈ 2–4 intern stipends → **hiring fundable from M2–M3.**

> Every number here is downstream of a real conversion-lift proof. If the product doesn't demonstrably lift conversion, churn erases the model.

---

## 7. Marketing plan (ABM-led, zero-budget-first)

Sweat-equity → organic → paid, in that order:

1. **Outbound ABM (primary engine):** LinkedIn + email to founders / ecom managers / CRO leads. ~10 hyper-personalized touches/day, each with a **Loom of the assistant running on *their* store**. Specificity > polish.
2. **Lighthouse case studies:** Calmosis lift % (framed as a universal number) + first international logo. Unlocks every other channel.
3. **Build-in-public on X / LinkedIn:** the global DTC operator audience lives on X. Post numbers, demos, journey. Free, high-trust distribution to exactly our buyer.
4. **DTC communities + newsletters / podcasts:** 2PM, DTC Newsletter, Operators, Repeat, relevant Slacks/Discords.
5. **Shopify App Store (global), positioned premium** (high-touch, not freemium). Seed reviews from pilots. Compounds from ~M3.
6. **Agency / partner channel:** Shopify Plus partners, CRO consultants, 3PLs → referrals for rev-share. The path beyond solo outbound.
7. **Paid ads only after a proven install→paid funnel (M4+).**

**Beachhead discipline:** own "premium AI concierge for wellness DTC" before widening.

---

## 8. Sales strategy (high-touch, account-based)

- **Low volume, high touch.** 50–100 ideal brands; quality over spray.
- **Store-specific Loom demo** = highest-converting weapon.
- **Paid pilot with a guarantee:** 30-day white-glove, "measurable lift or money back." De-risks the unknown-founder problem and forces us to deliver.
- **Lighthouse logos:** land 1–2 recognizable international wellness brands first — **discounted for the logo if needed**, in exchange for case study + testimonial + reference. The discount on logo #1–2 pays for itself many times over.
- **Motion:** land → prove (lift number in week 1) → expand (voice tier) → annual renewal.
- **Retention:** monthly "we added $X assisted revenue" report = renewal + referral engine.

---

## 9. The two things that make or break this

1. **Relatable proof.** Calmosis lift number (we own it → easy) + one international lighthouse logo.
2. **Reliability.** Premium buyers are unforgiving. The product must never fake or break in a demo. No claimed action without verified state-change.

---

## 10. Product priorities (only what serves revenue)

| Priority | Why |
|---|---|
| **Calmosis cart endpoint + lift instrumentation** | Our proof asset. We own the repo → flawless, no DOM guesswork. The input to every revenue number. |
| **Shopify native transactional (Cart/Storefront API)** | The product we actually sell. Reliable add-to-cart + checkout handoff. |
| **Install-time E2E gate** | Before any widget goes live transactional, an automated smoke completes add-to-cart + checkout on the real store. Fails → concierge-only. Kills "it's not working" complaints. |
| Custom-site brand endpoint (drop-in) | Build only when a paying customer needs it. |
| OpenKarta as a standard | Parked. Revisit after ~10 paying customers, or just adopt UCP. |

---

## 11. 90-day POA (sequence + gates)

**Phase 0 — Proof (Weeks 1–2)**
- Calmosis cart endpoint on our repo → one real, verified bot-driven purchase.
- Instrument conversion lift (bot-assisted vs. not). Produce the **lift number.**
- *Gate:* no working Calmosis transaction by end of week 1 → fix before anything else.

**Phase 1 — Lighthouse (Weeks 2–6)**
- Build Shopify native transactional + install-time E2E gate.
- Outbound to ~50 international wellness Shopify brands; land **1–2 lighthouse logos** (discounted for logo OK).
- Turn lighthouse + Calmosis into case studies.
- *Gate:* if no lighthouse logo by week 6 → revisit ICP / offer / pitch.

**Phase 2 — Sell at full price (Weeks 6–12)**
- Run premium ABM motion; paid pilots with guarantee.
- Launch Shopify App Store listing (premium).
- Hire first intern from logo #1–2 revenue.
- *Gate:* zero paid full-price pilots by day 60 → product not yet sellable; re-decide with data.

---

## 12. KPIs

- **Lift %** (Calmosis + each customer) — the north-star proof metric.
- New logos / month; MRR; ARR run-rate.
- Install → paid conversion (App Store).
- Net revenue retention; logo churn.
- Assisted revenue ($) generated for customers (the value story).

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Product doesn't demonstrably lift conversion | Prove on Calmosis *first*; money-back pilots force delivery. |
| Trust gap (solo, unknown, India→international premium) | Lighthouse logos, guarantee, store-specific demos, build-in-public. |
| Solo bandwidth caps acquisition | Partner/referral channel + App Store organic; hire from first revenue. |
| Voice (Gemini Live) COGS erodes margin | Voice = usage-priced premium tier only. |
| Reliability failure in front of premium buyer | Install-time E2E gate; never claim unverified actions. |
| Competition (Shopify Sidekick, Rep AI, etc.) | Vertical focus + outcome selling + voice differentiation. |

---

## 14. Immediate next actions

1. **Spec + build the Calmosis cart endpoint + lift instrumentation.** (Proof asset — input to everything.)
2. Build the **50–100 international wellness Shopify** target list.
3. Write the **outbound pitch + Loom script** for lighthouse logos.
4. Ship **Shopify native transactional + the install-time E2E gate.**

> Recommended start: **#1 (Calmosis proof).** Without the lift number, premium international buyers won't take a solo unknown seriously.
