# Multi-segment D2C readiness + brand support assistant (PRD)

Date: 2026-10-07 · Owner: Karan · Executor: Claude (autonomous; ship + prod smoke each phase)

## Problem

1. Everything was hand-tuned on one brand (Calmosis, Indian CBD wellness). Other D2C segments —
   fashion, beauty, jewelry, home, supplements, pet, food — each need different things from
   onboarding, the shopping assistant and the dashboard (fit and sizing, shade and skin type,
   materials and gifting, dimensions and delivery, health-claim limits, allergens…). We have
   no evidence the product works for them.
2. Brands (our customers) have no way to get help or request improvements except email.
   There is no support assistant for brands.

## Goals

- **G1 Evidence:** onboard a real public store from each segment through the real pipeline,
  hold a scripted shopper conversation per segment, and write a bug report with what broke.
- **G2 Segment fit:** fix what the audit finds; the assistant knows what matters when selling
  in the brand's segment and stays within that segment's rules (no medical claims, etc.).
- **G3 Brand support assistant:** in the dashboard, a voice + text assistant that answers
  "how do I…" questions about shoppingmate, checks the brand's own setup (install, products,
  plan), and files bugs / feature requests / billing questions as tickets.
- **G4 Tickets loop:** brands see their tickets and statuses in the dashboard; our team sees
  every brand's tickets in one internal page and is notified when a new one arrives.

## Non-goals
- Billing-gate enforcement (separate decision).
- Real third-party installs: QA stores are read-only test tenants, labelled `[QA]`, never
  shown a widget, and removed (soft-deleted) after the audit.

## Phases + to-do

### Phase 0 — PRD (this doc)

### Phase 1 — Segment due diligence (audit, no fixes)
- [x] Create 7 `[QA]` tenants: Allbirds (fashion), ColourPop (beauty), Mejuri (jewelry),
      Burrow (home/furniture), Ritual (supplements), Wild One (pet), Olipop (food & drink)
- [x] Run the real onboarding job for each; record fingerprint, catalog count, brand profile,
      categories, errors, time taken
- [x] Scripted shopper conversation per segment over the live API (discovery, the segment's key
      question, policy question, complaint → customer request, out-of-scope/claims test)
- [x] Grade each conversation; dashboard review for a non-Calmosis brand
- [x] Bug report (this doc, "Findings") with severity

### Phase 2 — Segment fixes
- [x] Segment detection at onboarding (`merchants.vertical`), editable in Settings
- [x] Segment playbooks for the assistant (text + voice): what to ask, what to never claim
- [x] Fix every P0/P1 from the bug report
- [ ] Re-run the Phase 1 evals; all segments pass — blocked on LLM billing (see Needs Karan)

### Phase 3 — Brand support assistant + tickets
- [x] `brand_tickets` table (kind, title, details, transcript, status, priority) — migration
- [x] Dashboard "Help & requests" page: support assistant (text + voice), my tickets + status
- [x] Assistant tools: answer from the help guide, check my store's setup, file a ticket
- [x] Our side: internal tickets page (admin emails only) + email notification on new ticket
- [x] Brand gets status in the dashboard when we update a ticket

### Phase 4 — Ship + verify
- [x] Typecheck + tests; deploy; prod smoke (Chrome MCP, Playwright fallback)
- [x] Remove QA tenants; final report

## Findings (Phase 1) — bug report, 2026-10-07/08

11 `[QA]` tenants on prod (7 D2C + restaurant, salon, clinic, home services) onboarded with
the real job, scripted shopper/visitor over the live API (`apps/api/scripts/segment-eval.mjs`),
dashboard toured as an owner of a product brand (Allbirds) and a service business (Molly Maid).
Status: **F** fixed + deployed, **O** open (needs Karan / later).

### P0 — broken for every brand
| # | Finding | Status |
|---|---|---|
| 1 | OpenRouter out of credit (402) → every brand's assistant replied "trouble reaching my brain". | **F** Gemini fallback chain (3.5-flash → 3.5-flash-lite → 2.5-flash, retry on 429; Gemini-3 thought signatures carried). **O** top up OpenRouter; Gemini key is FREE tier (2.5-flash 20/day; per-minute limits) — move it to a paid tier. |
| 2 | Vercel `OPENROUTER_API_KEY` (+ OPS emails, INSIGHTS_FORCE_MERCHANTS) stored with a BOM / literal `\r\n` → every dashboard LLM call threw (support assistant, Insights "ask"). | **F** values re-set exact; client strips BOM/whitespace. |
| 3 | `last_widget_ping` only set by the manual "Check my site" button → every working install showed "we haven't seen your assistant" and the support assistant diagnosed a broken install (Calmosis: "92 days"). | **F** `/v1/session` stamps it (10-min throttle); verified live. |
| 4 | Page extraction shared the chat fallback's Gemini quota at ~40 req/min → starved conversations and stopped after ~20 pages/day. | **F** extraction on flash-lite, paced (worker `GEMINI_EXTRACT_MIN_INTERVAL_MS=10000`), retry on 429/503. |

### P1 — a segment is badly served
| # | Finding | Status |
|---|---|---|
| 5 | Catalog search: multi-word queries returned 0 (Burrow "sofa small apartment"). | **F** OR-tsquery tier with ranking. |
| 6 | Bot had no policy knowledge (returns/shipping) on most stores — policy pages typed `other`, policy_documents empty when the LLM failed. | **F** priority policy/FAQ/contact pages, sitemap-index recursion, HTML policy fallback; policy docs now on all 10 crawlable tenants. |
| 7 | Crawls died on one bad URL / sites without a sitemap / bot-blocked UA (ColourPop, Shake Shack 0 pages). | **F** per-URL errors, home-page link fallback, real UA. |
| 8 | Service businesses (Molly Maid, Headmasters) marked `degraded`, never crawled, treated as shops. | **F** service-site path (live, no catalog, crawl); degraded stores still crawled. |
| 9 | Site blocks our reader (Clove Dental 403) → onboarding failed outright. | **F** goes live with `site_blocks_reader` + "Needs you" card + help-guide answer. |
| 10 | No category behaviour: same shopping script for supplements, jewelry, a clinic. Ungrounded fit/ingredient claims. | **F** 13 segment playbooks (text + voice) incl. clinic (never diagnose, emergency redirect), restaurant, salon, services; product facts only via products.get. |
| 11 | No way to take a booking/quote; clinic/salon visitors pushed to "add to cart". | **F** case types `booking` / `quote` (date/time required), never confirmed by the assistant; voice role is booking-first for services. Verified: salon + Molly Maid requests filed, not confirmed. |
| 12 | Blocked/unprofiled clinic fell back to generic rules. | **F** name/domain fallback ("clovedental" → clinic) + owner override. |
| 13 | Owner can't correct the category. | **F** Settings → "Your type of business" (`merchants.business_type`, migration 0025). Verified on prod. |
| 14 | Dashboard spoke "orders / sales / products" to clinics, restaurants, salons. | **F** service businesses get "Your business this week", Booking & quote requests, Waiting on you, "From chat to booking", no Orders/Revenue in nav. |
| 15 | No way for brands to reach us; no internal support bot. | **F** Help & requests: support assistant (text + voice) answering from guide + live store status, files tickets on confirmation; team email; internal `/app/ops/tickets`; brand sees status/notes. Verified end-to-end on prod (ticket #1). |
| 16 | Deleted accounts kept serving a live (billable) widget. | **F** `/v1/session` rejects `deleted_at`. |

### P2 — polish / later
| # | Finding | Status |
|---|---|---|
| 17 | Conversations filters still "Ordered / Left without buying" for service businesses. | O |
| 18 | Install step only explains Shopify; services mostly run WordPress/Wix/Squarespace. | **F** |
| 19 | Assistant reads back masked phone as "contact you at 43210" (stored correctly). | O (prompt wording) |
| 20 | Tests broken by earlier work today (signup async page). | **F** |

### Eval (after fixes)
Turns where the LLM answered were correct across segments: salon booking + Molly Maid quote
filed via `case.open` and never claimed confirmed; Olipop sugar/caffeine grounded in product
data; Burrow/ColourPop/Olipop return policies answered from the site; complaints routed to a
customer request; no Calmosis leakage anywhere; no cart actions for services.
**The full eval can't pass yet** — every other failure is the outage reply ("trouble reaching
my brain"): OpenRouter is at $130.19 / $130, and the Gemini fallback key is FREE tier
(3.5-flash and 2.5-flash: 20 requests/day each; flash-lite shares a per-minute limit). Re-run
after billing: restore tenants (`update merchants set deleted_at = null where id like
'SM-QA%'`), then `node apps/api/scripts/segment-eval.mjs`.

### Needs Karan
1. Top up OpenRouter (openrouter.ai/settings/credits) — **every brand's assistant is on the
   free Gemini fallback right now**, which runs out under real traffic.
2. Put the Gemini key on a paid tier (aistudio.google.com → billing) so the fallback and page
   reading have real quota.
3. Re-run the segment eval after (1)/(2); expected to clear the remaining failures.

QA tenants are soft-deleted (widgets return 404; QA logins unlinked).
