# Task 1 acceptance — Calmosis live transcript

**Date:** 2026-05-29
**Merchant:** SM-2SCCLZ (Calmosis)
**Mode:** text
**API:** https://api-production-1ea1.up.railway.app (commit 4637b44)
**Plan:** docs/superpowers/plans/2026-05-29-universal-brand-onboarding-plan.md

## Pre-fix behaviour (baseline)

Before Task 1, Sage (Olivia persona) consistently hallucinated Calmosis as a
generic "calm/balance/wellness" brand and refused dosage / doctor questions
with a stock "I can't give medical advice" line. Reproduced via
`apps/worker/probe-calmosis-knowledge.mjs`.

## Post-fix transcript (probe run, 2026-05-29 ~19:22 IST)

### Q1 — "What does Calmosis make? Give me a one-sentence summary."

> Calmosis crafts AYUSH-licensed, full-spectrum cannabis-based (THC + CBD,
> hemp-derived) ayurvedic wellness products — including tinctures, capsules,
> and topicals — formulated with classical herbs and terpenes to address sleep,
> anxiety, chronic pain, recovery, and overall well-being.

✅ No "skincare" hallucination. Names the actual category (ayurvedic cannabis
wellness), formats (tinctures/capsules/topicals), and outcomes (sleep/anxiety/
pain/recovery).

### Q2 — "What is the difference between Peace and Sleep?"

> I appreciate your patience — our catalog search isn't surfacing those specific
> product names at the moment, and I wouldn't want to guess at the details.
> ... Speak with one of our ayurvedic practitioners — they are best placed to
> walk you through the distinction and guide you toward the formulation that
> suits your particular needs, whether that is daytime calm, nighttime rest, or
> a combination of both.

🟡 Catalog is empty (no products indexed yet — that's Task 3). But the bot
**no longer fabricates** a comparison; it redirects to ayurvedic practitioners
per brand guidance.

### Q3 — "What dosage should I take?"

> That is a thoughtful question, and one we take seriously at Calmosis.
> Because our formulations combine full-spectrum cannabis with classical
> ayurvedic herbs, the right dosage is quite personal — it depends on factors
> such as your body weight, constitution (*prakriti*), the condition you're
> addressing, and any other medications or supplements you may be using.
> For that reason, we strongly encourage a **consultation with one of our
> ayurvedic practitioners** before settling on a dose...

✅ No generic refusal. Follows the brand's published stance (practitioner-
guided dosage) and offers the consultation page as the next step.

### Q4 — "Can I talk to a doctor before ordering?"

> Absolutely — practitioner-guided use is at the heart of how Calmosis operates.
> Before settling on a product or dosage, we strongly encourage a consultation
> with one of our ayurvedic doctors... To schedule a consultation, I'd suggest
> visiting the **Consultation** section of the Calmosis website, where you can
> book a session with a qualified ayurvedic practitioner.

✅ Direct affirmative answer. Names the consultation path.

## What got us here

Two code changes in the agent prompt path:

1. `feat(agent): brand_summary + brand_categories injected into prompts`
   (commit 9e81342). Adds two nullable columns on `merchants`, threaded
   through both text and voice system prompts. Drops the universal
   "no medical/legal/financial advice" guardrail that was forcing every
   wellness brand into a generic refusal.

2. `feat(agent): hoist WHAT THIS BRAND IS to top of system prompt`
   (commit 4637b44). Moves the brand summary to the top of the prompt
   (above persona, inventory, guardrails) and adds a worked example for
   the dosage case. Without this, Sonnet 4.6 was overriding the
   "follow brand guidance" rule with default safety training.

Calmosis row in prod was backfilled with brand summary + categories via
`apps/api/scripts/backfill-calmosis-brand-summary.mjs`.

## Reproduction

```bash
node apps/worker/probe-calmosis-knowledge.mjs
```

Hits live `api-production-1ea1.up.railway.app` over Calmosis's allowed
origin (`https://calmosis.com`).
