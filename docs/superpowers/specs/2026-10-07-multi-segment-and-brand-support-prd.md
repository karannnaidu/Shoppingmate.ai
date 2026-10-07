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
- [ ] Create 7 `[QA]` tenants: Allbirds (fashion), ColourPop (beauty), Mejuri (jewelry),
      Burrow (home/furniture), Ritual (supplements), Wild One (pet), Olipop (food & drink)
- [ ] Run the real onboarding job for each; record fingerprint, catalog count, brand profile,
      categories, errors, time taken
- [ ] Scripted shopper conversation per segment over the live API (discovery, the segment's key
      question, policy question, complaint → customer request, out-of-scope/claims test)
- [ ] Grade each conversation; dashboard review for a non-Calmosis brand
- [ ] Bug report (this doc, "Findings") with severity

### Phase 2 — Segment fixes
- [ ] Segment detection at onboarding (`merchants.vertical`), editable in Settings
- [ ] Segment playbooks for the assistant (text + voice): what to ask, what to never claim
- [ ] Fix every P0/P1 from the bug report
- [ ] Re-run the Phase 1 evals; all segments pass

### Phase 3 — Brand support assistant + tickets
- [ ] `brand_tickets` table (kind, title, details, transcript, status, priority) — migration
- [ ] Dashboard "Help & requests" page: support assistant (text + voice), my tickets + status
- [ ] Assistant tools: answer from the help guide, check my store's setup, file a ticket
- [ ] Our side: internal tickets page (admin emails only) + email notification on new ticket
- [ ] Brand gets status in the dashboard when we update a ticket

### Phase 4 — Ship + verify
- [ ] Typecheck + tests; deploy; prod smoke (Chrome MCP, Playwright fallback)
- [ ] Remove QA tenants; final report

## Findings (Phase 1)
_(filled in by the audit)_
