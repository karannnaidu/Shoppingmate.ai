# shoppingmate — Go-to-Production Objectives

**Date:** 2026-05-19
**Owner:** Karan
**Purpose:** Single high-level checklist of everything that has to be true before shoppingmate is sellable + defensible. Each bucket is independently scoped; each one will get its own design spec + implementation plan.

> Format: **technical name** followed by *(plain version)*. Skim the plain version; dive into the technical when needed.

---

## Bucket A — Sell-readiness *(stuff a customer notices missing on day 1)*

The smallest set that lets a real merchant pay us with confidence.

| # | Technical | Plain version |
|---|-----------|---------------|
| A1 | Plan 7 — conversion attribution (gtag → `/v1/conversion` → ledger → dashboard ROI tile) | *Prove the bot made the merchant money* |
| A2 | Phase 2 acceptance checklist (11 items in `docs/runbooks/2026-05-04-phase2-acceptance.md`) + tag `phase2-brand-dashboard-complete` | *Run the QA checklist on the live dashboard, cut a release tag* |
| A3 | DNS for `shoppingmate.ai` apex + `app.shoppingmate.ai` + `api.shoppingmate.ai` | *Real domain, not `*.vercel.app` / Railway URL* |
| A4 | Resend domain switch `openkarta.org` → `shoppingmate.ai` once DNS verifies | *Emails come from our domain, not the placeholder* |
| A5 | Rotate Cloudflare R2 token + add CORS policy to bucket | *Close the chat-history exposure from 2026-05-04* |
| A6 | `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID` set; LiveKit/Stripe/Anthropic/Gemini secrets pasted in Railway | *All keys in production env* |
| A7 | Gemini Live cost pilot — 100 conversations measured `$ /conv` with 95% CI | *Run 100 test calls, confirm unit economics — pre-seed-close blocker* |

**Done when:** a stranger can sign up at `shoppingmate.ai`, pay Starter $30, install the script on their store, run a real conversation, and see the attributed sale in their dashboard.

---

## Bucket B — Demo-undeniable *(the landing-page bot learns "hands")*

Turn the existing Sage demo from a talker into a do-er. Visitor on `shoppingmate.ai` watches the bot navigate, click, highlight, and speak exact prices — selling itself.

| # | Technical | Plain version |
|---|-----------|---------------|
| B1 | AX-tree-driven host-action tools: `site.navigate(path)`, `site.scroll_to(intent)`, `site.highlight(intent)` | *Bot can click links, scroll the page, glow on elements while explaining them* |
| B2 | Templated price voicing — `pricing.quote(plan_id)` tool returns pre-formatted speech string; `stripPrices` bypass list per session | *Bot reads "thirty dollars per month" reliably; LLM never generates the digits* |
| B3 | Showcase plans as products in demo merchant — 4 SKUs (Starter / Growth / Scale / Pro) with images + canonical prices + tour script in brand KB | *Sage can pull up "the Starter plan" card and walk the visitor through it* |
| B4 | Demo-merchant gate — host-action tools only active when `merchantId === SHOPPINGMATE_DEMO_MERCHANT_ID` (gate already exists in `packages/agent/src/runtime.ts`) | *These tools work on our marketing site only, until we generalize for production merchants* |

**Done when:** a visitor on `shoppingmate.ai` says "show me your pricing" and the bot navigates to /pricing, scrolls to the plan grid, highlights Starter, and voices "Starter is thirty dollars per month for one hundred conversations" — no hallucination, no dead air.

---

## Bucket C — Protocol layer *(the moat — no merchant writes code)*

shoppingmate becomes the Cloudflare for agentic commerce. Merchant pastes one tag, we expose them to OpenKarta + ACP (OpenAI/Stripe) + UCP (Google/Shopify). Merchant writes zero protocol code.

| # | Technical | Plain version |
|---|-----------|---------------|
| C1 | Hosted brand-agent service `apps/brand-agent/` exposing `agents.shoppingmate.ai/<slug>/v0/*` per merchant, backed by existing `packages/adapters/` | *We host the API endpoints for the merchant on our servers* |
| C2 | `OpenKartaAdapter` — consumer-side adapter; voice bot routes through OpenKarta verbs when merchant is conformant | *When merchant is on OpenKarta, our bot speaks the protocol directly* |
| C3 | ACP shim — product feed + 3 checkout flows generated from hosted-agent data | *Free OpenAI Instant Checkout exposure* |
| C4 | UCP shim — `.well-known/ucp` manifest generated from hosted-agent data | *Free Google AI Mode + Gemini exposure* |
| C5 | Onboarding wizard step — "Expose me on agent protocols" toggle (default ON), generates a single `<link rel="...">` snippet | *One checkbox in signup; we do the rest* |
| C6 | Catalog freshness — Shopify/Woo webhook → invalidate hosted-agent cache → next protocol call returns fresh data | *Merchant edits a price; our protocol endpoints update automatically* |

**Done when:** a stranger signs up, OAuths Shopify, ticks the protocol box, and is simultaneously live as: (a) a shoppingmate-instrumented store, (b) an OpenKarta brand agent in the registry, (c) an ACP-conformant merchant for ChatGPT, (d) a UCP-conformant merchant for Google. Total merchant time: ~2 minutes. Total merchant code written: 0 lines.

---

## Bucket D — Go-to-market substrate *(not engineering — track in ops, not here)*

| # | Item | Plain version |
|---|------|---------------|
| D1 | 2 design-partner LOIs signed (1 Shopify + 1 non-Shopify) | *2 friendly customers signed up to pilot* |
| D2 | Legal review of merchant ToS — selector cache, voice consent, stock-out liability | *Lawyer-blessed terms before any merchant signs* |
| D3 | Demo video / sales collateral — 4-cut package per `docs/superpowers/plans/2026-05-04-hero-roto-and-demo-video-plan.md` | *2-3 min video to send to prospects* |
| D4 | Pricing page polish + real-money signup → checkout flow tested | *Buy your own product end-to-end with a real card* |

**Tracked here for visibility but executed in Slack-ops / `docs/operating-model.md`, not as engineering plans.**

---

## Sequence

1. **Bucket A** — unblocks revenue. Without it, the rest is window-dressing.
2. **Bucket B** — turns the demo into a sales weapon. Brainstorming → spec → plan starts now.
3. **Bucket C** — the moat. Bigger architectural lift; needs its own dedicated spec.
4. **Bucket D** — runs in parallel with all engineering, owned in ops.

Each bucket gets its own spec at `docs/superpowers/specs/YYYY-MM-DD-<bucket>-design.md` and plan at `docs/superpowers/plans/YYYY-MM-DD-<bucket>-plan.md`.

---

## Status tracker

| Bucket | Spec | Plan | Status |
|--------|------|------|--------|
| A — sell-readiness | TBD | TBD | Pending brainstorm |
| B — demo-undeniable | [spec](docs/superpowers/specs/2026-05-19-bucket-b-demo-undeniable-design.md) | [plan](docs/superpowers/plans/2026-05-19-bucket-b-demo-undeniable.md) | implementation complete, pending operator acceptance |
| C — protocol layer | TBD | TBD | Pending brainstorm |
| D — go-to-market | n/a (ops) | n/a | Ongoing |
