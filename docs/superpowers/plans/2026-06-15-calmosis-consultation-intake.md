# Calmosis Consultation Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Calmosis bot collect a doctor-consultation request (name, age, optional condition, 10-digit phone + country code) in voice or text, persist it, email calm@calmosis.com, surface it on the brand dashboard — and stop the bot from ever speaking tool-call syntax.

**Architecture:** A server-side `consultation.request` tool on the Calmosis tool surface. The shared `runTurn` tool-loop (inherited by both the text WS in `apps/api` and the voice side-channel in `apps/voice-agent`) validates the args, calls an injected `submitConsultation` dep (insert row + fire-and-forget email), and emits a `consultation.requested` metric. PII redaction is moved so the visitor's raw message reaches the model (so the bot can read the dictated phone) while stored transcripts keep the redacted version. A new `stripToolSyntax` postprocessor guarantees no tool syntax reaches speech.

**Tech Stack:** TypeScript monorepo (pnpm), drizzle-orm + Postgres, Vitest, Next.js (web dashboard), Resend (email), OpenRouter Sonnet tool-calling.

**Spec:** `docs/superpowers/specs/2026-06-15-calmosis-consultation-intake-design.md`

**Test commands (from memory — use these exact forms):**
- A backend package: `cd packages/<pkg> && npx vitest run <file>`
- Changed backend packages together: `npx vitest run packages/agent packages/db apps/api apps/voice-agent`
- Web: `cd web && pnpm vitest run` (NOT root `npx vitest` — needs the `@`-alias in `web/vitest.config.ts`)

---

## File Structure

**Create:**
- `packages/agent/src/consultation.ts` — pure `validateConsultationRequest` + `ConsultationRequest` type
- `packages/agent/src/consultation.test.ts`
- `packages/db/src/schema/consultationRequests.ts` — table
- `packages/db/src/repos/consultationRepo.ts` — `createConsultationRequest`
- `packages/db/src/notify/consultationEmail.ts` — `sendConsultationEmail` (Resend)
- `packages/db/src/notify/submitConsultation.ts` — `submitConsultationRequest` (insert + email orchestrator)
- `packages/db/src/notify/submitConsultation.test.ts`
- `web/src/lib/consultations-repo.ts` — `listConsultations`
- `web/src/app/app/consultations/page.tsx` — dashboard page
- `web/src/lib/consultations-repo.test.ts`

**Modify:**
- `packages/agent/src/postprocess.ts` (+ `postprocess.test.ts`) — add `stripToolSyntax`
- `packages/agent/src/tools.ts` (+ `tools.test.ts`) — add `consultation.request` to Calmosis surface
- `packages/agent/src/runtime.ts` (+ `runtime.test.ts`) — `submitConsultation` dep, dispatch, transient-PII, `stripToolSyntax`
- `packages/agent/src/prompts/system.ts` (+ `prompts/system.test.ts`) — consultation block + anti-syntax rule
- `packages/agent/src/prompts/voice-instructions.ts` — anti-syntax rule
- `packages/db/src/schema/metricEvents.ts` — register `consultationRequested`
- `packages/db/src/schema/index.ts` — export new table
- `packages/db/src/index.ts` — export repo + submitter
- `packages/db/package.json` — add `resend` dep
- `apps/api/src/index.ts` — wire `submitConsultation` into runTurn deps
- `apps/voice-agent/src/bridge.ts` — thread `submitConsultation` through `BridgeDeps` → `RunTurnDeps`
- `apps/voice-agent/src/agentWorker.ts` — wire `submitConsultation` into `createBridge`
- `web/src/components/dashboard/Sidebar.tsx` (+ `Sidebar.test.tsx`) — add nav link

---

## Task 1: `stripToolSyntax` postprocessor

**Files:**
- Modify: `packages/agent/src/postprocess.ts`
- Test: `packages/agent/src/postprocess.test.ts`

- [ ] **Step 1: Write the failing test** — append to `packages/agent/src/postprocess.test.ts`:

```ts
import { stripToolSyntax } from './postprocess.js';

describe('stripToolSyntax', () => {
  it('removes a leaked dotted tool call with JSON args', () => {
    const out = stripToolSyntax(
      'I will take you there now. navigation.site.navigate({"url": "https://x.com/contact"})',
    );
    expect(out).toBe('I will take you there now.');
  });
  it('removes a bare tool call', () => {
    expect(stripToolSyntax('Sure. cart.add({"sku":"green-mantra"}) Done!')).toBe('Sure. Done!');
  });
  it('leaves normal prose with parentheses untouched', () => {
    const s = 'Green Mantra (our calming blend) is a great pick.';
    expect(stripToolSyntax(s)).toBe(s);
  });
  it('leaves a sentence that ends in a period untouched', () => {
    const s = 'You can consult our practitioner.';
    expect(stripToolSyntax(s)).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/postprocess.test.ts`
Expected: FAIL — `stripToolSyntax is not a function`.

- [ ] **Step 3: Implement** — append to `packages/agent/src/postprocess.ts`:

```ts
// Strip any leaked tool-call syntax from model speech, e.g.
// `site.navigate({"path":"/x"})` or `navigation.site.navigate({"url":...})`.
// Matches: one or more dot-separated identifiers immediately followed by a
// parenthesised argument list. Requires a '(' right after the name so ordinary
// prose like "Green Mantra (our blend)" is never touched.
const TOOL_SYNTAX_RE = /\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*\((?:[^()]|\{[^}]*\})*\)/g;

export function stripToolSyntax(input: string): string {
  return input.replace(TOOL_SYNTAX_RE, '').replace(/ {2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run src/postprocess.test.ts`
Expected: PASS (all, including the prose cases).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/postprocess.ts packages/agent/src/postprocess.test.ts
git commit -m "feat(agent): stripToolSyntax — never let tool-call syntax reach speech"
```

---

## Task 2: Pure consultation validation

**Files:**
- Create: `packages/agent/src/consultation.ts`
- Test: `packages/agent/src/consultation.test.ts`

- [ ] **Step 1: Write the failing test** — `packages/agent/src/consultation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateConsultationRequest } from './consultation.js';

describe('validateConsultationRequest', () => {
  it('accepts a valid request and defaults country code to +91', () => {
    const r = validateConsultationRequest({ name: 'Karan', age: 32, phone: '9876543210' });
    expect(r).toEqual({
      ok: true,
      value: { name: 'Karan', age: 32, condition: null, phoneCountryCode: '+91', phone: '9876543210' },
    });
  });
  it('strips spaces/dashes from a 10-digit phone', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '98765-43 210' });
    expect(r.ok && r.value.phone).toBe('9876543210');
  });
  it('keeps an optional condition (trimmed)', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '9876543210', condition: '  anxiety ' });
    expect(r.ok && r.value.condition).toBe('anxiety');
  });
  it('normalizes a custom country code to start with +', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '9876543210', phone_country_code: '1' });
    expect(r.ok && r.value.phoneCountryCode).toBe('+1');
  });
  it('rejects empty name', () => {
    expect(validateConsultationRequest({ name: '  ', age: 20, phone: '9876543210' })).toEqual({
      ok: false, reason: 'name is required',
    });
  });
  it('rejects non-integer or out-of-range age', () => {
    expect(validateConsultationRequest({ name: 'A', age: 0, phone: '9876543210' }).ok).toBe(false);
    expect(validateConsultationRequest({ name: 'A', age: 200, phone: '9876543210' }).ok).toBe(false);
    expect(validateConsultationRequest({ name: 'A', age: 3.5, phone: '9876543210' }).ok).toBe(false);
  });
  it('rejects a phone that is not 10 digits', () => {
    expect(validateConsultationRequest({ name: 'A', age: 20, phone: '12345' })).toEqual({
      ok: false, reason: 'phone must be exactly 10 digits',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/consultation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `packages/agent/src/consultation.ts`:

```ts
export type ConsultationRequest = {
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
};

export type ConsultationValidation =
  | { ok: true; value: ConsultationRequest }
  | { ok: false; reason: string };

export function validateConsultationRequest(args: Record<string, unknown>): ConsultationValidation {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (name.length === 0) return { ok: false, reason: 'name is required' };

  const ageNum = typeof args.age === 'number' ? args.age : Number(args.age);
  if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
    return { ok: false, reason: 'age must be a whole number between 1 and 120' };
  }

  const rawPhone = typeof args.phone === 'string' ? args.phone : String(args.phone ?? '');
  const phone = rawPhone.replace(/\D/g, '');
  if (phone.length !== 10) return { ok: false, reason: 'phone must be exactly 10 digits' };

  const rawCc = typeof args.phone_country_code === 'string' ? args.phone_country_code.trim() : '';
  const phoneCountryCode = rawCc.length === 0 ? '+91' : rawCc.startsWith('+') ? rawCc : `+${rawCc.replace(/\D/g, '')}`;

  const condRaw = typeof args.condition === 'string' ? args.condition.trim() : '';
  const condition = condRaw.length === 0 ? null : condRaw;

  return { ok: true, value: { name, age: ageNum, condition, phoneCountryCode, phone } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run src/consultation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/consultation.ts packages/agent/src/consultation.test.ts
git commit -m "feat(agent): pure validateConsultationRequest (name/age/phone/+cc/condition)"
```

---

## Task 3: DB table + schema export + migration

**Files:**
- Create: `packages/db/src/schema/consultationRequests.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generate: `packages/db/drizzle/00XX_*.sql`

- [ ] **Step 1: Create the table** — `packages/db/src/schema/consultationRequests.ts`:

```ts
import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const consultationRequests = pgTable(
  'consultation_requests',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'), // nullable: pointer to conversation transcript
    name: text('name').notNull(),
    age: integer('age').notNull(),
    condition: text('condition'), // nullable: visitor may share directly with the doctor
    phoneCountryCode: text('phone_country_code').notNull().default('+91'),
    phone: text('phone').notNull(),
    status: text('status').notNull().default('new'), // new | contacted | closed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantCreatedIdx: index('consultation_requests_merchant_created_idx').on(
      t.merchantId,
      t.createdAt.desc(),
    ),
  }),
);

export type ConsultationRequestRow = typeof consultationRequests.$inferSelect;
export type NewConsultationRequest = typeof consultationRequests.$inferInsert;
```

- [ ] **Step 2: Export it** — add to `packages/db/src/schema/index.ts` (after the last line):

```ts
export * from './consultationRequests.js';
```

- [ ] **Step 3: Generate the migration**

Run: `cd packages/db && pnpm db:generate`
Expected: a new `drizzle/00XX_*.sql` containing `CREATE TABLE "consultation_requests"` plus a snapshot under `drizzle/meta/`. Open the `.sql` and confirm it only ADDS the table (no drops of other tables).

- [ ] **Step 4: Typecheck**

Run: `cd packages/db && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/consultationRequests.ts packages/db/src/schema/index.ts packages/db/drizzle
git commit -m "feat(db): consultation_requests table + migration"
```

---

## Task 4: Repo + email + submitter orchestrator + metric name

**Files:**
- Create: `packages/db/src/repos/consultationRepo.ts`
- Create: `packages/db/src/notify/consultationEmail.ts`
- Create: `packages/db/src/notify/submitConsultation.ts`
- Test: `packages/db/src/notify/submitConsultation.test.ts`
- Modify: `packages/db/src/schema/metricEvents.ts`, `packages/db/src/index.ts`, `packages/db/package.json`

- [ ] **Step 1: Add `resend` dependency** — in `packages/db/package.json`, under `"dependencies"` add (match the version used in `web/package.json`; if unknown, use `"^4.0.0"`):

```json
"resend": "^4.0.0",
```

Run: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Register the metric name** — in `packages/db/src/schema/metricEvents.ts`, inside the `metricNames` object (before the closing `} as const;` at line ~100), add:

```ts
  consultationRequested: 'consultation.requested',
```

- [ ] **Step 3: Create the repo** — `packages/db/src/repos/consultationRepo.ts`:

```ts
import { db } from '../client.js';
import { consultationRequests, type NewConsultationRequest } from '../schema/consultationRequests.js';

export async function createConsultationRequest(values: NewConsultationRequest): Promise<number> {
  const [row] = await db.insert(consultationRequests).values(values).returning({ id: consultationRequests.id });
  return row.id;
}
```

- [ ] **Step 4: Create the email helper** — `packages/db/src/notify/consultationEmail.ts`:

```ts
import { Resend } from 'resend';

export type ConsultationEmailArgs = {
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
  sessionId: string | null;
};

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'https://shoppingmate-web.vercel.app';
const TO = 'calm@calmosis.com';

export async function sendConsultationEmail(args: ConsultationEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[consultation-email] RESEND_API_KEY not set — skipping email');
    return;
  }
  const resend = new Resend(apiKey);
  const transcript = args.sessionId
    ? `<p><a href="${DASHBOARD_URL}/app/conversations/${args.sessionId}">View conversation transcript</a></p>`
    : '';
  const condition = args.condition
    ? args.condition
    : '(not shared — visitor will discuss directly with the doctor)';
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Calmosis <onboarding@resend.dev>',
    to: TO,
    subject: `New consultation request — ${args.name}`,
    html: `<h2>New consultation request</h2>
<ul>
<li><strong>Name:</strong> ${args.name}</li>
<li><strong>Age:</strong> ${args.age}</li>
<li><strong>Condition:</strong> ${condition}</li>
<li><strong>Phone:</strong> ${args.phoneCountryCode} ${args.phone}</li>
</ul>
${transcript}`,
  });
}
```

- [ ] **Step 5: Write the failing submitter test** — `packages/db/src/notify/submitConsultation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

const createConsultationRequest = vi.fn();
const sendConsultationEmail = vi.fn();
vi.mock('../repos/consultationRepo.js', () => ({ createConsultationRequest }));
vi.mock('./consultationEmail.js', () => ({ sendConsultationEmail }));

import { submitConsultationRequest } from './submitConsultation.js';

const base = {
  merchantId: 'SM-2SCCLZ', sessionId: 's1', name: 'Karan', age: 32,
  condition: null, phoneCountryCode: '+91', phone: '9876543210',
};

describe('submitConsultationRequest', () => {
  it('persists then returns ok, and fires the email', async () => {
    createConsultationRequest.mockResolvedValue(7);
    sendConsultationEmail.mockResolvedValue(undefined);
    const r = await submitConsultationRequest(base);
    expect(r).toEqual({ ok: true });
    expect(createConsultationRequest).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(sendConsultationEmail).toHaveBeenCalledOnce());
  });
  it('still returns ok when the email throws (email is fire-and-forget)', async () => {
    createConsultationRequest.mockResolvedValue(8);
    sendConsultationEmail.mockRejectedValue(new Error('resend down'));
    const r = await submitConsultationRequest(base);
    expect(r).toEqual({ ok: true });
  });
  it('returns not ok when the insert fails', async () => {
    createConsultationRequest.mockRejectedValue(new Error('db down'));
    const r = await submitConsultationRequest(base);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/db && npx vitest run src/notify/submitConsultation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the submitter** — `packages/db/src/notify/submitConsultation.ts`:

```ts
import { createConsultationRequest } from '../repos/consultationRepo.js';
import { sendConsultationEmail } from './consultationEmail.js';

export type SubmitConsultationArgs = {
  merchantId: string;
  sessionId: string | null;
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
};

export async function submitConsultationRequest(
  args: SubmitConsultationArgs,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await createConsultationRequest({
      merchantId: args.merchantId,
      sessionId: args.sessionId,
      name: args.name,
      age: args.age,
      condition: args.condition,
      phoneCountryCode: args.phoneCountryCode,
      phone: args.phone,
    });
  } catch (err) {
    console.error('[consultation] insert failed', err);
    return { ok: false, reason: 'could not save the request' };
  }
  // Fire-and-forget: a mail failure must not fail the request (row is saved).
  void sendConsultationEmail({
    name: args.name, age: args.age, condition: args.condition,
    phoneCountryCode: args.phoneCountryCode, phone: args.phone, sessionId: args.sessionId,
  }).catch((err) => console.error('[consultation] email failed', err));
  return { ok: true };
}
```

- [ ] **Step 8: Export from db index** — add to `packages/db/src/index.ts`:

```ts
export { createConsultationRequest } from './repos/consultationRepo.js';
export { submitConsultationRequest } from './notify/submitConsultation.js';
export type { SubmitConsultationArgs } from './notify/submitConsultation.js';
```

- [ ] **Step 9: Run test + typecheck**

Run: `cd packages/db && npx vitest run src/notify/submitConsultation.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/repos/consultationRepo.ts packages/db/src/notify packages/db/src/index.ts packages/db/src/schema/metricEvents.ts packages/db/package.json pnpm-lock.yaml
git commit -m "feat(db): consultation repo + Resend email + submit orchestrator + metric name"
```

---

## Task 5: Add `consultation.request` to the Calmosis tool surface

**Files:**
- Modify: `packages/agent/src/tools.ts`
- Test: `packages/agent/src/tools.test.ts`

- [ ] **Step 1: Write the failing test** — append to `packages/agent/src/tools.test.ts` (follow the file's existing import of `buildToolSurface`; reuse its merchant fixtures/helpers):

```ts
describe('consultation.request tool', () => {
  const names = (m: Parameters<typeof buildToolSurface>[0]) =>
    buildToolSurface(m).map((t) => t.function.name);

  it('is present on the Calmosis surface', () => {
    const calmosis = { ...baseMerchant, id: 'SM-2SCCLZ', siteGraphEnabled: true } as typeof baseMerchant;
    expect(names(calmosis)).toContain('consultation.request');
  });
  it('is absent on a non-Calmosis surface', () => {
    const other = { ...baseMerchant, id: 'SM-OTHER', siteGraphEnabled: true } as typeof baseMerchant;
    expect(names(other)).not.toContain('consultation.request');
  });
});
```

> If `baseMerchant`/fixture names differ in `tools.test.ts`, reuse whatever that file already uses to build a Calmosis (`id: 'SM-2SCCLZ'`, `siteGraphEnabled: true`) and a non-Calmosis merchant.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/tools.test.ts`
Expected: FAIL — surface does not contain `consultation.request`.

- [ ] **Step 3: Implement** — in `packages/agent/src/tools.ts`, add a tool def after `CALMOSIS_CART_TOOLS` (around line 83):

```ts
const CALMOSIS_CONSULT_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'consultation.request',
    description:
      "Submit a request for a complimentary doctor/practitioner consultation. Call this ONLY after you have collected the visitor's name, age, and a 10-digit phone number (and asked whether it is an Indian number for the country code). Condition is optional — never insist on it.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: "Visitor's name" },
        age: { type: 'integer', minimum: 1, maximum: 120 },
        phone: { type: 'string', description: '10-digit phone number (digits only)' },
        phone_country_code: { type: 'string', description: 'e.g. "+91" for India. Defaults to +91.' },
        condition: { type: 'string', description: 'Optional — the concern they want help with. Omit if not shared.' },
      },
      required: ['name', 'age', 'phone'],
    },
  },
};
```

Then in `buildToolSurface`, inside the `if (merchant.siteGraphEnabled)` branch, change the Calmosis site-tools line so the consult tool is included only for Calmosis:

```ts
  if (merchant.siteGraphEnabled) {
    const siteTools = isCalmosisStitch(merchant)
      ? [...SITE_NAV_TOOLS, ...CALMOSIS_CART_TOOLS, CALMOSIS_CONSULT_TOOL]
      : SITE_NAV_TOOLS;
    return [...base, ...siteTools];
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run src/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/tools.ts packages/agent/src/tools.test.ts
git commit -m "feat(agent): consultation.request tool on the Calmosis surface"
```

---

## Task 6: Runtime — dispatch, transient-PII, stripToolSyntax

**Files:**
- Modify: `packages/agent/src/runtime.ts`
- Test: `packages/agent/src/runtime.test.ts`

- [ ] **Step 1: Write the failing test** — append to `packages/agent/src/runtime.test.ts` (reuse the file's existing `runTurn` harness/helpers for building deps, merchant `SM-2SCCLZ`, session, and a queued `chatToolsImpl` mock that emits a `consultation.request` tool call then a final say):

```ts
describe('consultation.request dispatch', () => {
  it('calls submitConsultation with validated fields and emits the metric', async () => {
    const submitConsultation = vi.fn().mockResolvedValue({ ok: true });
    const recordMetric = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({
      submitConsultation,
      recordMetric,
      chatToolsImpl: queueChatTools([
        { text: '', toolCalls: [{ id: 'c1', name: 'consultation.request',
          argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '98765 43210' }) }] },
        { text: 'Done — our practitioner will reach out.', toolCalls: [] },
      ]),
    });
    const events = await collect(runTurn(deps, calmosisMerchant, freshSession(), userText('book a consult')));
    expect(submitConsultation).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Karan', age: 32, phone: '9876543210', phoneCountryCode: '+91',
      merchantId: 'SM-2SCCLZ',
    }));
    expect(recordMetric).toHaveBeenCalledWith('consultation.requested', expect.any(Object));
    expect(events.some((e) => e.type === 'tool_result' && e.toolName === 'consultation.request' && e.ok)).toBe(true);
  });

  it('returns a re-ask envelope (ok:false) on invalid phone without calling submit', async () => {
    const submitConsultation = vi.fn();
    const deps = makeDeps({
      submitConsultation,
      chatToolsImpl: queueChatTools([
        { text: '', toolCalls: [{ id: 'c1', name: 'consultation.request',
          argumentsJson: JSON.stringify({ name: 'Karan', age: 32, phone: '123' }) }] },
        { text: 'That number is not 10 digits — can you recheck?', toolCalls: [] },
      ]),
    });
    const events = await collect(runTurn(deps, calmosisMerchant, freshSession(), userText('book a consult')));
    expect(submitConsultation).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'tool_result' && e.toolName === 'consultation.request' && !e.ok)).toBe(true);
  });
});
```

> Match the helper names already present in `runtime.test.ts`. If the file lacks `makeDeps/queueChatTools/collect/userText/freshSession/calmosisMerchant`, build the equivalents from the patterns already used by other tests in that file (they already mock `chatTools` and assert on yielded events).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/runtime.test.ts -t consultation`
Expected: FAIL — `consultation.request` falls through to `dispatchTool` → `unknown_tool` (ok:false), and `submitConsultation`/metric never fire.

- [ ] **Step 3a: Add the dep** — in `packages/agent/src/runtime.ts`, add to `RunTurnDeps` (after `recommendationStore?` at ~line 97), and import the validator at the top:

```ts
// top of file, with the other imports:
import { validateConsultationRequest } from './consultation.js';
```

```ts
  // Persist + notify boundary for consultation.request (Calmosis). Wired in
  // apps/api (text) and apps/voice-agent (voice). When omitted the tool returns
  // an unsupported envelope (dev guard; never in prod).
  submitConsultation?: (req: {
    name: string;
    age: number;
    condition: string | null;
    phoneCountryCode: string;
    phone: string;
    merchantId: string;
    sessionId: string;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
```

- [ ] **Step 3b: Dispatch the tool** — in the tool loop, add a branch BEFORE the `site.*`/`isCalmosisCart` host-action `if` (i.e. right after `const isCalmosisCart = ...`, before `if (call.name === 'site.navigate' ...`):

```ts
        if (call.name === 'consultation.request') {
          const v = validateConsultationRequest(args);
          if (!v.ok) {
            envelope = { ok: false, kind: 'unsupported', reason: v.reason };
          } else if (!deps.submitConsultation) {
            envelope = { ok: false, kind: 'unsupported', reason: 'consultation_not_wired' };
          } else {
            const res = await deps.submitConsultation({
              ...v.value,
              merchantId: merchant.id,
              sessionId: session.sessionId,
            });
            envelope = res.ok
              ? { ok: true, value: { submitted: true } }
              : { ok: false, kind: 'unsupported', reason: res.reason };
            if (res.ok) {
              await deps.recordMetric('consultation.requested', {
                merchantId: merchant.id,
                sessionId: session.sessionId,
              });
            }
          }
          // NOTE: do NOT emit `agent.tool.invoked` here — the shared code after
          // this if/else chain (the existing recordMetric('agent.tool.invoked'))
          // already fires for every tool, consultation.request included.
        } else if (
          call.name === 'site.navigate' ||
          call.name === 'site.scroll_to' ||
```

(That is: convert the existing `if (call.name === 'site.navigate' || ...` into the `else if` shown on the last two lines above — the rest of that block is unchanged.)

- [ ] **Step 3c: Transient PII** — change the main-path user message so the MODEL sees the raw text but STORED history keeps the redacted text.

Replace lines ~232-237:

```ts
  const userText = redactPii(message.text);
  const history: AnthropicMessage[] = [
    { role: 'system', content: buildSystemPrompt(merchant, promptOpts) },
    ...session.history,
    { role: 'user', content: userText },
  ];
```

with:

```ts
  // Transient PII: the model needs the visitor's raw words this turn (so it can
  // read a dictated phone number into consultation.request), but we never PERSIST
  // raw PII — stored history keeps the redacted form.
  const redactedUserText = redactPii(message.text);
  const history: AnthropicMessage[] = [
    { role: 'system', content: buildSystemPrompt(merchant, promptOpts) },
    ...session.history,
    { role: 'user', content: message.text },
  ];
```

Then in the final `updated` session (lines ~459-467), change the stored user turn from `userText` to `redactedUserText`:

```ts
    history: [...session.history, { role: 'user', content: redactedUserText }, finalAssistant],
```

- [ ] **Step 3d: Apply stripToolSyntax to speech** — import it and apply before yielding say segments in BOTH paths.

Add to the postprocess import at top (currently `import { redactPii, segmentSay, stripPrices } from './postprocess.js';`):

```ts
import { redactPii, segmentSay, stripPrices, stripToolSyntax } from './postprocess.js';
```

Card-tap path (line ~221-222): change

```ts
    const { text: stripped } = stripPrices(ack.text);
    for (const segment of segmentSay(stripped)) yield { type: 'say', text: segment };
```

to

```ts
    const { text: stripped } = stripPrices(stripToolSyntax(ack.text));
    for (const segment of segmentSay(stripped)) yield { type: 'say', text: segment };
```

Main path (line ~434): change

```ts
  const { text: stripped, hits } = stripPrices(responseText, new Set(accumulatedAllowedTokens));
```

to

```ts
  const { text: stripped, hits } = stripPrices(stripToolSyntax(responseText), new Set(accumulatedAllowedTokens));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run src/runtime.test.ts`
Expected: PASS (new consultation tests + all existing runtime tests still green).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/runtime.ts packages/agent/src/runtime.test.ts
git commit -m "feat(agent): dispatch consultation.request, transient PII to model, strip tool syntax from speech"
```

---

## Task 7: Wire `submitConsultation` in the text path (apps/api)

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Import the submitter** — add to the `@shoppingmate/db` import in `apps/api/src/index.ts` (it already imports `db`, `schema`):

```ts
import { submitConsultationRequest } from '@shoppingmate/db';
```

- [ ] **Step 2: Add to runTurn deps** — in the `const deps = { ... }` object (lines ~222-237), after `dispatchHostAction,` add:

```ts
      submitConsultation: (req) =>
        submitConsultationRequest({
          merchantId: req.merchantId,
          sessionId: req.sessionId,
          name: req.name,
          age: req.age,
          condition: req.condition,
          phoneCountryCode: req.phoneCountryCode,
          phone: req.phone,
        }),
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Run api tests**

Run: `npx vitest run apps/api`
Expected: PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): wire submitConsultation into the text agent runtime"
```

---

## Task 8: Wire `submitConsultation` in the voice path

**Files:**
- Modify: `apps/voice-agent/src/bridge.ts`
- Modify: `apps/voice-agent/src/agentWorker.ts`

- [ ] **Step 1: Add to `BridgeDeps`** — in `apps/voice-agent/src/bridge.ts`, add to the `BridgeDeps` type (after `recommendationStore?` at ~line 62):

```ts
  // Persist + notify boundary for consultation.request — threaded into RunTurnDeps.
  submitConsultation?: RunTurnDeps['submitConsultation'];
```

- [ ] **Step 2: Forward into `runDeps`** — in `createBridge`, in the `runDeps` object (lines ~102-111), after `recommendationStore: deps.recommendationStore,` add:

```ts
        submitConsultation: deps.submitConsultation,
```

- [ ] **Step 3: Wire the impl in agentWorker** — in `apps/voice-agent/src/agentWorker.ts`, add the import (alongside the existing `@shoppingmate/db` imports):

```ts
import { submitConsultationRequest } from '@shoppingmate/db';
```

Then in the `createBridge({ ... })` call (after `recordMetric` / the other deps, near line ~364-374), add:

```ts
      submitConsultation: (req) =>
        submitConsultationRequest({
          merchantId: req.merchantId,
          sessionId: req.sessionId,
          name: req.name,
          age: req.age,
          condition: req.condition,
          phoneCountryCode: req.phoneCountryCode,
          phone: req.phone,
        }),
```

- [ ] **Step 4: Typecheck + tests**

Run: `cd apps/voice-agent && pnpm typecheck && cd ../.. && npx vitest run apps/voice-agent`
Expected: no type errors; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/bridge.ts apps/voice-agent/src/agentWorker.ts
git commit -m "feat(voice): wire submitConsultation through the bridge into runTurn"
```

---

## Task 9: Prompt — consultation flow + anti-syntax rule

**Files:**
- Modify: `packages/agent/src/prompts/system.ts`
- Modify: `packages/agent/src/prompts/voice-instructions.ts`
- Test: `packages/agent/src/prompts/system.test.ts`

- [ ] **Step 1: Write the failing test** — append to `packages/agent/src/prompts/system.test.ts` (reuse the file's Calmosis merchant fixture / `buildSystemPrompt` usage):

```ts
describe('Calmosis consultation prompt', () => {
  it('includes the consultation intake flow and the consultation.request tool', () => {
    const p = buildSystemPrompt(calmosisMerchant, {});
    expect(p).toMatch(/consultation\.request/);
    expect(p).toMatch(/10-digit/i);
  });
  it('forbids speaking tool/function syntax', () => {
    const p = buildSystemPrompt(calmosisMerchant, {});
    expect(p).toMatch(/never (say|speak)[^.]*tool/i);
  });
});
```

> Use whatever Calmosis fixture `system.test.ts` already defines (id `SM-2SCCLZ`, `siteGraphEnabled: true`). If none, build one inline like the other tests in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/prompts/system.test.ts -t consultation`
Expected: FAIL.

- [ ] **Step 3a: Add the consultation block** — in `packages/agent/src/prompts/system.ts`, define a Calmosis-only block next to `calmosisPurchaseBlock` (after it, ~line 79):

```ts
  const calmosisConsultBlock = isCalmosisStitch(merchant)
    ? `
DOCTOR CONSULTATION (you can book a complimentary consult)
When the visitor wants to talk to a doctor/practitioner — or asks about dosage, suitability, or a medical concern where the right answer is "speak to a practitioner" — OFFER to set up a complimentary consultation instead of sending them to a contact page.
To set it up, collect, conversationally and one or two at a time:
1. Their name.
2. Their age.
3. The condition or concern they'd like help with — OPTIONAL. Tell them they can skip it and share it directly with the doctor. Never insist.
4. Their phone number. It must be 10 digits. Ask "Is this an Indian number?" — if yes (or unsure), use country code +91; otherwise ask for their country code.
Then read the details back to confirm, and call consultation.request({name, age, phone, phone_country_code, condition}). Only say it's done if the tool call SUCCEEDED. If it returns an error (e.g. the phone isn't 10 digits), tell them what to fix and ask again. Do NOT just send them to /contact.
`
    : '';
```

Then add `${calmosisConsultBlock}` to the returned prompt string (the `return \`You are ${persona.name}...` template around line 94-95), e.g. right after `${calmosisPurchaseBlock}`:

```ts
  return `You are ${persona.name}, an AI shopping assistant for ${brandName}.
${brandSummaryBlock}${navigationBlock}${calmosisPurchaseBlock}${calmosisConsultBlock}${buyFlowBlock}
```

- [ ] **Step 3b: Add the anti-syntax rule** — in the `SPEAKING RULES` section (around lines 114-117), add a bullet:

```ts
- NEVER speak tool names, function names, JSON, or code. Never say things like "site.navigate" or "navigation.site.navigate({...})" or "consultation.request({...})". Call tools silently as function calls and describe the action in plain words ("opening that page now", "got it, I'll have our practitioner reach out").
```

- [ ] **Step 3c: Voice instructions** — in `packages/agent/src/prompts/voice-instructions.ts`, add the same prohibition near the existing speaking guidance:

```ts
- Never speak tool names, function calls, JSON, or code aloud (e.g. never say "site.navigate" or "consultation.request({...})"). Call tools silently and narrate the action naturally.
```

- [ ] **Step 4: Run tests**

Run: `cd packages/agent && npx vitest run src/prompts`
Expected: PASS (new + existing prompt tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/prompts/system.ts packages/agent/src/prompts/voice-instructions.ts packages/agent/src/prompts/system.test.ts
git commit -m "feat(agent): Calmosis consultation intake prompt + no-tool-syntax-in-speech rule"
```

---

## Task 10: Dashboard — consultations repo + page + nav

**Files:**
- Create: `web/src/lib/consultations-repo.ts`
- Create: `web/src/app/app/consultations/page.tsx`
- Create: `web/src/lib/consultations-repo.test.ts`
- Modify: `web/src/components/dashboard/Sidebar.tsx`, `web/src/components/dashboard/Sidebar.test.tsx`

> ⚠️ Per `web/AGENTS.md`: this Next.js has breaking changes. Before writing the page, read the relevant guide under `web/node_modules/next/dist/docs/` (App Router server components / `headers()` usage) and mirror the existing `web/src/app/app/audit/page.tsx` (already correct for this version).

- [ ] **Step 1: Write the failing repo test** — `web/src/lib/consultations-repo.test.ts` (mirror `web/src/lib/audit-repo.test.ts`; mock `./db` the same way that test does):

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const where = vi.fn();
const orderBy = vi.fn();
const limit = vi.fn();
const chain = { where: () => chain, orderBy: () => chain, limit: () => limit() } as any;
vi.mock('./db', () => ({ db: { select: () => ({ from: () => chain }) } }));

import { listConsultations } from './consultations-repo';

describe('listConsultations', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns rows for a merchant within the window', async () => {
    limit.mockResolvedValue([
      { id: 1, name: 'Karan', age: 32, condition: null, phoneCountryCode: '+91',
        phone: '9876543210', status: 'new', sessionId: 's1', createdAt: new Date() },
    ]);
    const rows = await listConsultations({ merchantId: 'SM-2SCCLZ', days: 30 });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Karan');
  });
});
```

> Confirm the exact mock shape against `web/src/lib/audit-repo.test.ts` and match it (the chain mock above is illustrative; reuse the real test's approach).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm vitest run src/lib/consultations-repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repo** — `web/src/lib/consultations-repo.ts`:

```ts
import { db } from './db';
import { consultationRequests } from '@shoppingmate/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export type ConsultationRow = {
  id: number;
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
  status: string;
  sessionId: string | null;
  createdAt: Date;
};

export async function listConsultations(args: {
  merchantId: string;
  days: number;
}): Promise<ConsultationRow[]> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: consultationRequests.id,
      name: consultationRequests.name,
      age: consultationRequests.age,
      condition: consultationRequests.condition,
      phoneCountryCode: consultationRequests.phoneCountryCode,
      phone: consultationRequests.phone,
      status: consultationRequests.status,
      sessionId: consultationRequests.sessionId,
      createdAt: consultationRequests.createdAt,
    })
    .from(consultationRequests)
    .where(and(eq(consultationRequests.merchantId, args.merchantId), gte(consultationRequests.createdAt, since)))
    .orderBy(desc(consultationRequests.createdAt))
    .limit(500);
  return rows as ConsultationRow[];
}
```

- [ ] **Step 4: Run repo test to verify it passes**

Run: `cd web && pnpm vitest run src/lib/consultations-repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the page** — `web/src/app/app/consultations/page.tsx` (mirrors `audit/page.tsx`):

```tsx
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConsultations } from '@/lib/consultations-repo';

export default async function ConsultationsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConsultations({ merchantId: session.merchant.id, days: 30 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Consultations
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Doctor-consultation requests the assistant captured in the last 30 days. Click a row to open
          the conversation transcript.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">
          No consultation requests yet. When a visitor asks to talk to a doctor, the assistant collects
          their details and they appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Transcript</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-muted/50">
                  <td className="px-4 py-2 text-text-secondary">{r.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.age}</td>
                  <td className="px-4 py-2 text-text-secondary">{r.condition ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.phoneCountryCode} {r.phone}</td>
                  <td className="px-4 py-2 text-xs uppercase tracking-wide">{r.status}</td>
                  <td className="px-4 py-2">
                    {r.sessionId ? (
                      <Link href={`/app/conversations/${r.sessionId}`} className="text-violet hover:underline">
                        View
                      </Link>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add the nav link + update its test** — in `web/src/components/dashboard/Sidebar.tsx`, add to the `NAV` array after the Conversations entry:

```ts
  { href: '/app/consultations', label: 'Consultations' },
```

In `web/src/components/dashboard/Sidebar.test.tsx`, add an assertion mirroring the existing link assertions:

```ts
  it('renders the Consultations link', () => {
    render(<Sidebar pathname="/app" />);
    expect(screen.getByRole('link', { name: 'Consultations' })).toHaveAttribute('href', '/app/consultations');
  });
```

> Match the render/import style already in `Sidebar.test.tsx`.

- [ ] **Step 7: Run web tests + typecheck**

Run: `cd web && pnpm vitest run && pnpm exec tsc --noEmit`
Expected: all green (previous 78 + the new repo & sidebar tests), no type errors.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/consultations-repo.ts web/src/lib/consultations-repo.test.ts web/src/app/app/consultations/page.tsx web/src/components/dashboard/Sidebar.tsx web/src/components/dashboard/Sidebar.test.tsx
git commit -m "feat(web): consultations dashboard page + repo + nav link"
```

---

## Task 11: Full verification + migration + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full backend test sweep**

Run: `npx vitest run packages/agent packages/db apps/api apps/voice-agent`
Expected: all PASS.

- [ ] **Step 2: Web test sweep**

Run: `cd web && pnpm vitest run`
Expected: all PASS.

- [ ] **Step 3: Builds**

Run: `pnpm -r --filter @shoppingmate/db --filter @shoppingmate/agent --filter @shoppingmate/api --filter @shoppingmate/voice-agent build && cd web && pnpm exec tsc --noEmit`
Expected: clean (tsc) builds.

- [ ] **Step 4: Apply the migration to the live DB**

Run (from memory: reach Postgres via `DATABASE_PUBLIC_URL`):
`cd packages/db && DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm db:migrate`
Expected: the `consultation_requests` migration applies; no errors. (PowerShell: `$env:DATABASE_URL=$env:DATABASE_PUBLIC_URL; pnpm db:migrate`.)

- [ ] **Step 5: Confirm RESEND env on the runtime services**

Ensure `RESEND_API_KEY` (and optionally `RESEND_FROM`, `DASHBOARD_URL`) are set on the Railway `api` and `voice-agent` services. If missing, the email is skipped (warning logged) but the request still saves.

- [ ] **Step 6: Deploy** (per memory `reference_deploy_mechanics`)

```bash
railway up --service api
railway up --service voice-agent
cd web && pnpm prebuild && vercel deploy --prod --yes
```

- [ ] **Step 7: Live smoke** — drive a Calmosis bot session (voice and text): "book a doctor consultation" → bot collects name/age/(skip condition)/phone(+91) → confirms → submits. Verify:
  - a row in `consultation_requests` (`node apps/api/scripts/` style query, or db studio),
  - an email at calm@calmosis.com with the transcript link,
  - the request on `/app/consultations`,
  - the bot NEVER speaks tool syntax in either mode.

- [ ] **Step 8: Final commit (if any verification fixes were needed)**

```bash
git add -A && git commit -m "chore(consultation): verification fixes + migration"
```
```

---

## Acceptance (maps to spec)

1. Voice + text intake collects name/age/(optional)condition/phone+cc, confirms, submits → spec §Behavior, Tasks 5,6,9.
2. Row persisted, email to calm@calmosis.com, visible on `/app/consultations` → spec §3,§5,§7, Tasks 3,4,10.
3. Bot never speaks tool syntax; consult/nav intents call real tools → spec §8,§9, Tasks 1,6,9.
