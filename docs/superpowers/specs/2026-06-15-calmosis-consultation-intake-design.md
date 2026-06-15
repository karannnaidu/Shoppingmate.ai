# Calmosis Consultation Request Intake — Design

**Date:** 2026-06-15
**Status:** Approved (brainstorm), pending implementation
**Scope:** Calmosis (`SM-2SCCLZ`) only. Voice **and** text parity required.

## Problem

When a Calmosis visitor asks to consult a doctor, the bot currently dead-ends them on the contact page. Worse, a live voice transcript showed the bot **speaking raw tool-call syntax** and inventing a tool that doesn't exist:

> "I will take you to the contact page now. `navigation.site.navigate({"url": "https://calmosis.com/contact"})`"

Two defects: (1) tool-call syntax leaked into speech instead of executing, and (2) the model hallucinated `navigation.site.navigate({url})` — the real tool is `site.navigate({path})` — so nothing navigated.

## Goal

Replace the contact-page dead-end with a **consultation request intake**: the bot collects the visitor's details in conversation, submits a real request that is persisted + emailed to the brand, and confirms to the visitor. Plus harden the bot so tool syntax never reaches speech.

Out of scope (YAGNI): slot booking, calendar invites, reminders, reschedule/cancel, SMS, multi-practitioner routing. Calmosis-only (a per-brand flag generalizes it later).

## Behavior

Trigger: visitor asks to consult a doctor/practitioner, OR asks a dosage/medical/suitability question where Calmosis's brand guidance already says "consult a practitioner."

The bot collects, conversationally:

| Field | Required | Rules |
|---|---|---|
| Name | yes | non-empty |
| Age | yes | integer 1–120 |
| Condition / reason | **no** | bot explicitly says "you can skip this and share it directly with the doctor" |
| Phone | yes | exactly **10 digits** (after stripping spaces/dashes); bot asks "is this an Indian number?" → stores `+91` by default, or the country code the visitor gives |

The bot reads the details back for confirmation, then calls `consultation.request`. On success: a natural confirmation ("Done — our practitioner will reach out on +91 98765 43210"). On a validation failure the bot relays the issue and re-asks (e.g. "that number isn't 10 digits — could you re-check?").

## Architecture

A **server-side tool** (not a host action — no widget/storefront change). The agent calls `consultation.request`; the shared `runTurn` tool-loop validates, persists, and emails. Both text (`apps/api`) and voice (`apps/voice-agent`, which routes visitor text through the same `runTurn` side-channel) inherit it.

### 1. Tool surface — `packages/agent/src/tools.ts`

Add `consultation.request` to the Calmosis surface (gated by `isCalmosisStitch`, alongside `CALMOSIS_CART_TOOLS`):

```
consultation.request({
  name: string,            // required
  age: integer,            // required, 1–120
  phone: string,           // required, 10 digits
  phone_country_code?: string,  // default "+91"
  condition?: string       // optional
})
```

### 2. Validation — `packages/agent/src/consultation.ts` (new, pure)

`validateConsultationRequest(args): { ok: true; value: ConsultationRequest } | { ok: false; reason: string }`.
- name: trimmed, non-empty.
- age: integer 1–120.
- phone: strip non-digits; must be exactly 10 digits; country code defaults to `+91`, normalized to start with `+`.
- condition: optional, trimmed, may be empty/undefined.

Pure + unit-tested. The runtime uses it; the model never sees raw DB errors.

### 3. Runtime dispatch — `packages/agent/src/runtime.ts`

New optional dep on `RunTurnDeps` (persistence/notify boundary, mirroring `RecommendationStore`):

```ts
submitConsultation?: (req: ConsultationRequest & { merchantId: string; sessionId: string })
  => Promise<{ ok: true } | { ok: false; reason: string }>;
```

In the tool loop, special-case `call.name === 'consultation.request'` **before** the generic `dispatchTool`:
- `validateConsultationRequest(args)` → on failure, envelope `{ ok: false, kind: 'unsupported', reason }` so the model re-asks.
- on success, call `deps.submitConsultation` → envelope reflects result.
- emit `recordMetric('consultation.requested', { merchantId, sessionId })` on success (threads into the existing event pipeline / dashboard).
- if `submitConsultation` is undefined, return `{ ok:false, kind:'unsupported', reason:'consultation_not_wired' }`.

### 4. Persistence — `packages/db`

New table `consultation_requests`:

| column | type | notes |
|---|---|---|
| id | serial PK | |
| merchant_id | text | FK-ish to merchants |
| session_id | text nullable | links to the conversation transcript |
| name | text | |
| age | integer | |
| condition | text nullable | |
| phone_country_code | text default `'+91'` | |
| phone | text | 10-digit national number |
| status | text default `'new'` | follow-up tracking (new/contacted/closed) |
| created_at | timestamptz default now() | |

Drizzle schema + generated migration (no destructive changes).

### 5. Notification email — `apps/api`

A small Resend helper in `apps/api` (reusing `RESEND_API_KEY`, mirroring `web/src/lib/resend.ts`). On a persisted request, send to **calm@calmosis.com**:
- subject: `New consultation request — {name}`
- body: name, age, condition (or "(not shared — will share with doctor)"), `{country_code} {phone}`, and a transcript link `https://<dashboard>/app/conversations/{sessionId}`.

Email failure must **not** fail the request — persistence is the source of truth; log + continue. The `submitConsultation` impl inserts the row, then fire-and-forgets the email.

### 6. Wiring the impl

`submitConsultation` is constructed where DB lives and passed into `runTurn` deps, same places that already wire `recordMetric` / `recommendationStore` / the ConversationRecorder:
- `apps/api` (text WS path)
- `apps/voice-agent/src/agentWorker.ts` (voice side-channel)

A shared factory (e.g. `createConsultationSubmitter({ db, sendEmail })`) keeps both call-sites identical.

### 7. Dashboard — `web`

> ⚠️ Per `web/AGENTS.md`, this Next.js has breaking changes — read the relevant guide in `node_modules/next/dist/docs/` before writing any page/route code.

- `web/src/lib/consultations-repo.ts` — `listConsultations({ merchantId, days })` reading `consultation_requests` (mirrors `audit-repo.ts`).
- `web/src/app/app/consultations/page.tsx` — table: name, age, condition, `{cc} {phone}`, time, status, transcript link (`/app/conversations/{sessionId}`).
- Sidebar nav link "Consultations".

### 8. Prompt changes — `packages/agent/src/prompts/`

- **`system.ts`**: add a Calmosis `CONSULTATION` block (gated by `isCalmosisStitch`) describing the intake flow + field rules + "call `consultation.request`". Replace the "I'll take you to the contact page" behavior for medical/consult intents.
- **Anti-syntax hardening (both `system.ts` + `voice-instructions.ts`)**: explicit rule — "NEVER speak tool names, function names, JSON, or code (e.g. never say 'site.navigate' or 'navigation.site.navigate({...})'). Just talk naturally and call the tool. The tool names are exactly: `site.navigate`, `cart.add`, `consultation.request`, … — use them only as function calls, never in speech."

### 9. Belt-and-suspenders — `packages/agent/src/postprocess.ts`

Add `stripToolSyntax(text)`: remove leaked `identifier.identifier(...)` / `name({...json...})` patterns from say text. Applied in `runTurn` before yielding `say` segments (alongside `stripPrices`). Guarantees no tool syntax reaches the visitor regardless of prompt adherence — this is the durable fix for defect (1).

## Error handling

- Invalid fields → structured `reason` → bot re-asks (never a generic refusal).
- `submitConsultation` undefined → `consultation_not_wired` (dev guard; never in prod).
- DB insert failure → envelope `{ ok:false }` → bot apologizes + offers the contact page as fallback.
- Email failure → swallowed (logged); request still saved + shown on dashboard.

## Testing

- `consultation.test.ts` — validation: valid, empty name, age out of range/non-int, phone with spaces/dashes (10 digits), phone wrong length, default `+91`, custom country code, optional condition.
- `runtime.test.ts` — `consultation.request` calls `submitConsultation` + emits `consultation.requested`; validation failure returns re-ask envelope; undefined dep returns `consultation_not_wired`.
- `tools.test.ts` — `consultation.request` present only for Calmosis surface.
- `postprocess.test.ts` — `stripToolSyntax` removes `foo.bar({...})` and `navigation.site.navigate({"url":...})` while leaving normal prose untouched.
- consultations-repo test (web) mirroring audit-repo test.
- `system.test.ts` — Calmosis prompt contains the consultation block + anti-syntax rule.

## Acceptance

1. Voice + text: "book a doctor consultation" → bot collects name/age/(optional condition)/phone(+cc), confirms, submits.
2. Row in `consultation_requests`; email at calm@calmosis.com with transcript link; request visible on `/app/consultations`.
3. Bot never speaks tool syntax (voice or text); navigation/consult intents call real tools.
