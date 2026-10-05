# Nav PRD Phase 4 — Customer case capture + contact capture (plan)

PRD § Phase 4. Flag: `CASE_CAPTURE` (`*` or merchant ids) on api + voice-agent.

1. DB: `support_cases` (migration 0022) — type, summary, details jsonb, contact name/phone/email, consent, urgency, sentiment, status open|in_progress|resolved, session/visitor ids.
2. `packages/db/src/notify/submitCase.ts` — insert + fire-and-forget Resend email to the merchant's OWNER emails (merchant_owners → users), owner-language subject/body ("[Urgent] Unhappy customer — Asha (Calmosis)"), links to the conversation + inbox.
3. Consultations stay as-is (table, email, page) and are mirrored into `support_cases` as type `consult` (no second email).
4. Agent: `case.ts` validator (type enum, summary, per-type requirement — tracking needs order number, a phone OR email with format checks + normalisation, explicit consent, bad_review → high urgency); `case.open` tool behind the flag (wrapper around the existing surface builder — no existing tool changes); runtime branch → `deps.submitCase` → envelope with `#reference`, metric `case.opened`; prompt "CUSTOMER CARE" block (ask only what's missing, contact at the value moment, acknowledge-first + no upsell for unhappy customers, never post reviews, one-line read-back with consent, never invent tracking).
5. Wiring: apps/api deps + voice bridge/agentWorker deps.
6. Dashboard `/app/cases` "Customer requests": urgent-first cards, plain-language type chips, To do / Handled / All, "Mark as handled" server action, link to conversation; sidebar entry.

4.11 (visitor profile merge): the case stores `visitor_id`; contact details already flow into `visitor_profiles` via the existing session-end profiler — no separate merge.
