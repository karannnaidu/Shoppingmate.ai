# Intent Capture — Phase 1 (Capture + Store Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At each session's end, extract a structured customer-intent record from the conversation and merge it into a persistent per-visitor profile — the data foundation the dashboard and personalization phases build on.

**Architecture:** A deterministic session-end profiler (one LLM pass over the transcript + funnel facts, reusing the existing `chat` infra like `checkout-extract`) produces a structured record. That record extends the conversation tags we already emit and is upserted into a new `visitor_profiles` table keyed by the existing `visitor_id`. No bot tool-calling involved. Live classifier + personalization + dashboard are later phases.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres), `@shoppingmate/shared` `chat()` (OpenRouter), Vitest.

Spec: `docs/superpowers/specs/2026-06-21-customer-intent-and-data-capture-design.md`

---

## File Structure

- Create `packages/agent/src/intent-profiler.ts` — `extractConversationProfile(transcript, facts, chat)` → validated structured record. One responsibility: turn a transcript + funnel facts into the record.
- Create `packages/agent/src/intent-profiler.test.ts` — unit tests (mocked `chat`).
- Modify `packages/agent/src/conversationRecorder.ts` — add the intent record type to `ConversationTags` (so it rides the existing `conversationCompleted` emission).
- Modify `packages/agent/src/index.ts` — export `extractConversationProfile` + types.
- Create `packages/db/src/schema/visitorProfiles.ts` — the `visitor_profiles` table.
- Modify `packages/db/src/schema/index.ts` — export the new table.
- Create `packages/db/src/repos/visitorProfileRepo.ts` — `upsertVisitorProfile(merge)` + `loadVisitorProfile(merchantId, visitorId)`.
- Create `packages/db/src/repos/visitorProfileRepo.test.ts` — merge-logic unit tests (pure merge fn, no DB).
- Modify the session-end call site (where `recorder.finish()` / `conversationCompleted` is emitted — confirm in `apps/voice-agent/src/agentWorker.ts` and the chat path) to run the profiler and upsert the profile.

---

### Task 1: Intent record type + profiler extraction

**Files:**
- Create: `packages/agent/src/intent-profiler.ts`
- Test: `packages/agent/src/intent-profiler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { extractConversationProfile } from './intent-profiler.js';

const facts = { cartAdds: 1, checkoutReached: false, purchased: false, mode: 'voice' as const };

describe('extractConversationProfile', () => {
  it('parses the model JSON into a validated record', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: `{"intent":"ready_to_buy","intentConfidence":0.8,"needs":["sleep"],"objections":["price"],
        "preferences":{"products":["sleep-mantra"]},"affect":{"sentiment":"positive"},
        "identity":{"name":"Karan","city":"Bangalore"},"dropStage":null}`,
    });
    const r = await extractConversationProfile('Visitor: I need help sleeping ...', facts, chat);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.intent).toBe('ready_to_buy');
      expect(r.record.needs).toContain('sleep');
      expect(r.record.identity.name).toBe('Karan');
    }
  });

  it('falls back to a safe empty record when the model output is unparseable', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'sorry' });
    const r = await extractConversationProfile('x', facts, chat);
    expect(r.ok).toBe(true); // never blocks session end
    if (r.ok) expect(r.record.intent).toBe('browsing');
  });

  it('coerces an unknown intent to browsing', async () => {
    const chat = vi.fn().mockResolvedValue({ text: `{"intent":"banana"}` });
    const r = await extractConversationProfile('x', facts, chat);
    expect(r.ok && r.record.intent).toBe('browsing');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run packages/agent/src/intent-profiler.test.ts`
Expected: FAIL — `extractConversationProfile` not found.

- [ ] **Step 3: Implement `intent-profiler.ts`**

```ts
import type { ChatFn } from './checkout-extract.js';

export const INTENTS = [
  'browsing', 'researching', 'comparing', 'ready_to_buy', 'price_sensitive',
  'support_issue', 'medical_consult', 'bulk_b2b', 'post_purchase',
] as const;
export type Intent = (typeof INTENTS)[number];

export type ConversationFacts = {
  cartAdds: number;
  checkoutReached: boolean;
  purchased: boolean;
  mode: 'voice' | 'text';
};

export type IntentRecord = {
  intent: Intent;
  intentConfidence: number; // 0..1
  needs: string[];
  objections: string[];
  preferences: { products?: string[]; flavours?: string[]; blissClub?: boolean; coupon?: string };
  affect: { sentiment: 'positive' | 'neutral' | 'negative'; confused?: boolean };
  identity: { name?: string; phone?: string; email?: string; city?: string; pincode?: string; age?: number; language?: string };
  dropStage: string | null;
};

export type ProfileResult = { ok: true; record: IntentRecord };

const EMPTY: IntentRecord = {
  intent: 'browsing', intentConfidence: 0, needs: [], objections: [],
  preferences: {}, affect: { sentiment: 'neutral' }, identity: {}, dropStage: null,
};

const SYSTEM = `You analyze a finished shopping conversation transcript (English/Hindi/Hinglish) and output ONE JSON object with keys: intent, intentConfidence, needs, objections, preferences, affect, identity, dropStage.
- intent MUST be one of: ${INTENTS.join(', ')}.
- intentConfidence: 0..1. needs/objections: short lowercase tags. preferences: {products[],flavours[],blissClub,coupon}. affect: {sentiment: positive|neutral|negative, confused}. identity: only fields the visitor actually gave (name,phone,email,city,pincode,age,language). dropStage: where they stopped, or null.
- NEVER invent identity values. If unsure, omit.`;

export async function extractConversationProfile(
  transcript: string,
  facts: ConversationFacts,
  chat: ChatFn,
): Promise<ProfileResult> {
  let parsed: Partial<IntentRecord> = {};
  try {
    const { text } = await chat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Funnel facts: ${JSON.stringify(facts)}\n\nTranscript:\n${transcript}\n\nReturn the JSON now.` },
    ]);
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) parsed = JSON.parse(text.slice(s, e + 1)) as Partial<IntentRecord>;
  } catch {
    return { ok: true, record: { ...EMPTY } };
  }
  const intent = (INTENTS as readonly string[]).includes(parsed.intent as string)
    ? (parsed.intent as Intent)
    : 'browsing';
  return {
    ok: true,
    record: {
      ...EMPTY,
      ...parsed,
      intent,
      intentConfidence: typeof parsed.intentConfidence === 'number' ? parsed.intentConfidence : 0,
      needs: Array.isArray(parsed.needs) ? parsed.needs.map(String) : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections.map(String) : [],
      preferences: parsed.preferences ?? {},
      affect: { sentiment: parsed.affect?.sentiment ?? 'neutral', confused: parsed.affect?.confused },
      identity: parsed.identity ?? {},
      dropStage: parsed.dropStage ?? null,
    },
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run packages/agent/src/intent-profiler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Export from the package index**

In `packages/agent/src/index.ts`, after the `checkout-extract` export, add:

```ts
export {
  extractConversationProfile,
  INTENTS,
  type Intent,
  type IntentRecord,
  type ConversationFacts,
} from './intent-profiler.js';
```

- [ ] **Step 6: Build + commit**

Run: `pnpm --filter @shoppingmate/agent build`
Expected: tsc succeeds.

```bash
git add packages/agent/src/intent-profiler.ts packages/agent/src/intent-profiler.test.ts packages/agent/src/index.ts
git commit -m "feat(agent): conversation intent profiler (extract structured record)"
```

---

### Task 2: Extend ConversationTags with the intent record

**Files:**
- Modify: `packages/agent/src/conversationRecorder.ts`

- [ ] **Step 1: Add the optional field to `ConversationTags`**

In `packages/agent/src/conversationRecorder.ts`, add to the `ConversationTags` type (import the type from `./intent-profiler.js`):

```ts
import type { IntentRecord } from './intent-profiler.js';
// ... in ConversationTags:
  /** Structured intent record from the session-end profiler (Phase 1). */
  intent?: IntentRecord;
```

(The recorder does not set it; the call site attaches it before persisting — keeps the recorder pure.)

- [ ] **Step 2: Build + commit**

Run: `pnpm --filter @shoppingmate/agent build`
Expected: tsc succeeds.

```bash
git add packages/agent/src/conversationRecorder.ts
git commit -m "feat(agent): carry intent record on ConversationTags"
```

---

### Task 3: visitor_profiles table

**Files:**
- Create: `packages/db/src/schema/visitorProfiles.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema** (follow the `conversationSessions.ts` style)

```ts
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const visitorProfiles = pgTable(
  'visitor_profiles',
  {
    id: text('id').primaryKey(), // `${merchantId}:${visitorId}`
    merchantId: text('merchant_id').notNull().references(() => merchants.id),
    visitorId: text('visitor_id').notNull(),
    identity: jsonb('identity').notNull().default({}),
    topIntents: jsonb('top_intents').notNull().default([]),
    needs: jsonb('needs').notNull().default([]),
    objections: jsonb('objections').notNull().default([]),
    productsOfInterest: jsonb('products_of_interest').notNull().default([]),
    lastOutcome: text('last_outcome'),
    lastDropStage: text('last_drop_stage'),
    sessionCount: integer('session_count').notNull().default(0),
    lifetimeValueCents: integer('lifetime_value_cents').notNull().default(0),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMerchantVisitor: uniqueIndex('visitor_profiles_merchant_visitor').on(t.merchantId, t.visitorId),
    byMerchant: index('visitor_profiles_merchant').on(t.merchantId),
  }),
);
```

- [ ] **Step 2: Export it** — in `packages/db/src/schema/index.ts` add `export * from './visitorProfiles.js';`

- [ ] **Step 3: Generate + run the migration**

Run: `pnpm --filter @shoppingmate/db drizzle-kit generate` (match the repo's existing migration command — check `packages/db/package.json` scripts).
Expected: a new SQL migration file under the drizzle migrations dir.

- [ ] **Step 4: Build + commit**

```bash
git add packages/db/src/schema/visitorProfiles.ts packages/db/src/schema/index.ts packages/db/drizzle
git commit -m "feat(db): visitor_profiles table"
```

---

### Task 4: visitorProfileRepo — pure merge fn + DB upsert/load

**Files:**
- Create: `packages/db/src/repos/visitorProfileRepo.ts`
- Test: `packages/db/src/repos/visitorProfileRepo.test.ts`

- [ ] **Step 1: Write the failing test (pure merge fn only — no DB)**

```ts
import { describe, expect, it } from 'vitest';
import { mergeProfile } from './visitorProfileRepo.js';
import type { IntentRecord } from '@shoppingmate/agent';

const rec = (over: Partial<IntentRecord>): IntentRecord => ({
  intent: 'ready_to_buy', intentConfidence: 0.8, needs: ['sleep'], objections: ['price'],
  preferences: { products: ['sleep-mantra'] }, affect: { sentiment: 'positive' },
  identity: { name: 'Karan' }, dropStage: 'address', ...over,
});

describe('mergeProfile', () => {
  it('starts a fresh profile from the first record', () => {
    const p = mergeProfile(null, rec({}), { outcome: 'abandoned', attributedCents: 0 });
    expect(p.sessionCount).toBe(1);
    expect(p.identity.name).toBe('Karan');
    expect(p.topIntents).toContain('ready_to_buy');
    expect(p.productsOfInterest).toContain('sleep-mantra');
  });
  it('latest-wins identity, accumulates intents/needs, sums LTV, bumps count', () => {
    const first = mergeProfile(null, rec({ identity: { name: 'K' } }), { outcome: 'abandoned', attributedCents: 0 });
    const second = mergeProfile(first, rec({ identity: { name: 'Karan', email: 'k@c.com' }, needs: ['stress'] }), { outcome: 'purchased', attributedCents: 450000 });
    expect(second.sessionCount).toBe(2);
    expect(second.identity.name).toBe('Karan'); // latest wins
    expect(second.identity.email).toBe('k@c.com');
    expect(second.needs).toEqual(expect.arrayContaining(['sleep', 'stress']));
    expect(second.lifetimeValueCents).toBe(450000);
    expect(second.lastOutcome).toBe('purchased');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run packages/db/src/repos/visitorProfileRepo.test.ts`
Expected: FAIL — `mergeProfile` not found.

- [ ] **Step 3: Implement the repo (pure `mergeProfile` + DB fns)**

```ts
import { eq, and } from 'drizzle-orm';
import type { IntentRecord } from '@shoppingmate/agent';
import { db } from '../client.js';
import { visitorProfiles } from '../schema/visitorProfiles.js';

export type ProfileRow = {
  id: string; merchantId: string; visitorId: string;
  identity: IntentRecord['identity'];
  topIntents: string[]; needs: string[]; objections: string[]; productsOfInterest: string[];
  lastOutcome: string | null; lastDropStage: string | null;
  sessionCount: number; lifetimeValueCents: number; lastSeen: Date;
};

const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

export function mergeProfile(
  prev: ProfileRow | null,
  rec: IntentRecord,
  end: { outcome: string; attributedCents: number },
): Omit<ProfileRow, 'id' | 'merchantId' | 'visitorId' | 'lastSeen'> {
  return {
    identity: { ...(prev?.identity ?? {}), ...rec.identity }, // latest wins
    topIntents: uniq([...(prev?.topIntents ?? []), rec.intent]),
    needs: uniq([...(prev?.needs ?? []), ...rec.needs]),
    objections: uniq([...(prev?.objections ?? []), ...rec.objections]),
    productsOfInterest: uniq([...(prev?.productsOfInterest ?? []), ...(rec.preferences.products ?? [])]),
    lastOutcome: end.outcome,
    lastDropStage: rec.dropStage,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
    lifetimeValueCents: (prev?.lifetimeValueCents ?? 0) + Math.max(0, end.attributedCents),
  };
}

export async function loadVisitorProfile(merchantId: string, visitorId: string): Promise<ProfileRow | null> {
  const rows = await db.select().from(visitorProfiles)
    .where(and(eq(visitorProfiles.merchantId, merchantId), eq(visitorProfiles.visitorId, visitorId))).limit(1);
  return (rows[0] as ProfileRow) ?? null;
}

export async function upsertVisitorProfile(
  merchantId: string, visitorId: string, rec: IntentRecord, end: { outcome: string; attributedCents: number },
): Promise<void> {
  const prev = await loadVisitorProfile(merchantId, visitorId);
  const merged = mergeProfile(prev, rec, end);
  const id = `${merchantId}:${visitorId}`;
  await db.insert(visitorProfiles).values({ id, merchantId, visitorId, ...merged, lastSeen: new Date() })
    .onConflictDoUpdate({ target: visitorProfiles.id, set: { ...merged, lastSeen: new Date() } });
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run packages/db/src/repos/visitorProfileRepo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Build + commit**

Run: `pnpm --filter @shoppingmate/db build`

```bash
git add packages/db/src/repos/visitorProfileRepo.ts packages/db/src/repos/visitorProfileRepo.test.ts
git commit -m "feat(db): visitor profile upsert/merge repo"
```

---

### Task 5: Wire the profiler at session end (voice + chat)

**Files:**
- Modify: `apps/voice-agent/src/agentWorker.ts` (the `recorder.finish()` / session-end path)
- Modify: the chat session-end path in `apps/api/src` (locate where the text session emits `conversationCompleted`)

- [ ] **Step 1: At voice session end, run the profiler + upsert**

Find where the voice worker finishes the recorder and emits `conversationCompleted`. Before/after that emission add (using the precise model + the same `chat` import the checkout flow uses):

```ts
import { extractConversationProfile } from '@shoppingmate/agent';
import { upsertVisitorProfile } from '@shoppingmate/db';
// at session end (after recorder.finish(...) gives `tags`):
try {
  const transcript = recorder.snapshot().map((t) => `${t.role === 'user' ? 'Visitor' : 'Calmio'}: ${t.content}`).join('\n');
  const profile = await extractConversationProfile(
    transcript,
    { cartAdds: tags.cart_adds, checkoutReached: tags.checkout_reached, purchased: tags.outcome === 'purchased', mode: 'voice' },
    (messages) => chat({ model: checkoutModel, messages, responseFormat: 'json', maxTokens: 512 }),
  );
  tags.intent = profile.record; // rides the conversationCompleted emission
  await upsertVisitorProfile(merchant.id, visitorId, profile.record, { outcome: tags.outcome, attributedCents: tags.attributed_cents });
} catch (err) {
  log.warn({ err, sessionId }, 'intent profiler failed (non-fatal)');
}
```

- [ ] **Step 2: Mirror it in the chat (text) session-end path** with `mode: 'text'` and that path's transcript/visitorId.

- [ ] **Step 3: Build both apps**

Run: `pnpm --filter @shoppingmate/voice-agent build && pnpm --filter @shoppingmate/api build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add apps/voice-agent/src/agentWorker.ts apps/api/src
git commit -m "feat(voice,api): run intent profiler + upsert visitor profile at session end"
```

---

### Task 6: Expose profile load for personalization (Phase 2 hook)

**Files:**
- Modify: `packages/db/src/index.ts` (export `loadVisitorProfile`, `upsertVisitorProfile`)

- [ ] **Step 1:** Ensure `packages/db/src/index.ts` re-exports the repo:

```ts
export { loadVisitorProfile, upsertVisitorProfile, mergeProfile, type ProfileRow } from './repos/visitorProfileRepo.js';
```

- [ ] **Step 2: Build + commit**

Run: `pnpm --filter @shoppingmate/db build`

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export visitor profile repo for personalization"
```

---

## Self-Review

- **Spec coverage (Phase 1):** data model → Task 1 (record) + Task 3 (table columns); conversation record extension → Task 2; visitor profile store → Tasks 3–4; session-end profiler hook → Task 5; profile load (for Phase 2 personalization) → Task 6. Live classifier, dashboard views, and the personalization *delivery* are Phases 2–4 (separate plans). Covered.
- **Placeholders:** none — every code step has full code. Two paths need confirming at implementation time (the exact chat-session-end file in `apps/api/src`, and the repo's drizzle-kit generate command); both are explicitly called out to locate, not left vague.
- **Type consistency:** `IntentRecord` defined in Task 1 is used identically in Tasks 2, 4, 5; `mergeProfile`/`upsertVisitorProfile`/`loadVisitorProfile` names match across Tasks 4 and 6.

## Out of scope (later phase plans)

- Phase 2: load profile at session start → bake summary into Gemini `systemInstruction` (voice) + system prompt (text).
- Phase 3: dashboard views (intent overview, demand/unmet-demand, friction, audience, per-conversation tags).
- Phase 4: live per-turn classifier + executor steering + event-driven voice nudges.
