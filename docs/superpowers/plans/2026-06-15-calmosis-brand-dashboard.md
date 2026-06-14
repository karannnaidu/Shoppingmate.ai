# Calmosis Brand Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing `/app` dashboard a genuine paid product for the Calmosis team: real conversation transcripts, a conversions/order ledger (audit trail), a bot-driven funnel (cart → checkout → purchase), and a near-real-time live view — with every existing Phase 2 feature verified.

**Architecture:** Reuse the Next.js `/app` dashboard (Calmosis logs in as a merchant). Emit the missing `conversationCompleted` event (shared `ConversationRecorder` helper) from both the voice worker and the text WS to light up the already-built Conversations/transcript pages. Add funnel metrics (`cart.add`, `checkout.reached`) in the shared agent runtime so both paths inherit them. Add a `'cod'` conversion source. Build three frontend surfaces: Audit ledger page, Funnel card, Live panel.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres), Hono (API), LiveKit (voice), Next.js 16 (App Router, RSC), Vitest.

---

## File structure

**Backend (packages/agent, apps):**
- Create: `packages/agent/src/conversationRecorder.ts` — accumulate turns + funnel/outcome flags, produce `conversationCompleted` tags.
- Create: `packages/agent/src/conversationRecorder.test.ts`
- Modify: `packages/agent/src/runtime.ts` — emit `cart.add` / `checkout.reached` funnel metrics at host-action dispatch.
- Modify: `packages/agent/src/index.ts` — export the recorder.
- Modify: `packages/db/src/schema/metricEvents.ts` — register new metric names.
- Modify: `packages/db/src/schema/conversionEvents.ts` (+ `apps/api/src/services/attributeOrder.ts`) — allow `matchSource: 'cod'`.
- Modify: `apps/api/src/routes/conversion.ts` — honor `payload.matchSource === 'cod'`.
- Modify: `apps/voice-agent/src/agentWorker.ts` — wire recorder + emit on Disconnect.
- Modify: `apps/api/src/index.ts` — wire recorder + emit on session_end.

**Frontend (web):**
- Create: `web/src/lib/audit-repo.ts` (+ `.test.ts`) — conversions ledger query.
- Create: `web/src/lib/funnel-repo.ts` (+ `.test.ts`) — funnel aggregation.
- Create: `web/src/app/app/audit/page.tsx` — ledger page.
- Create: `web/src/components/dashboard/FunnelCard.tsx` — funnel widget.
- Create: `web/src/components/dashboard/LivePanel.tsx` — polling live widget (client).
- Create: `web/src/app/api/live/route.ts` (+ `.test.ts`) — live snapshot endpoint.
- Modify: `web/src/components/dashboard/Sidebar.tsx` — add Audit nav.
- Modify: `web/src/app/app/page.tsx` — add FunnelCard + LivePanel.

---

## Phase 0 — Verification baseline

### Task 0: Establish baseline + confirm the conversationCompleted gap

- [ ] **Step 1: Run the web test suite**

Run: `cd web && pnpm vitest run`
Expected: green (memory cites 71/71). Record the actual count.

- [ ] **Step 2: Typecheck the workspace**

Run: `pnpm -r typecheck` (or `cd web && pnpm exec tsc --noEmit`)
Expected: no errors. Record any.

- [ ] **Step 3: Confirm the gap**

Run: `git grep -n "conversationCompleted" -- '*.ts' ':!*test*'`
Expected: only *readers* (`kpi-repo.ts`, `conversations-repo.ts`) — no writer. This is the documented finding that Phase 1 fixes.

- [ ] **Step 4: Commit a verification note**

Write findings to `docs/runbooks/2026-06-15-calmosis-dashboard-verification.md` and commit.

---

## Phase 1 — Conversation capture (transcripts + Conversations page fix)

### Task 1: ConversationRecorder helper (TDD)

**Files:**
- Create: `packages/agent/src/conversationRecorder.ts`
- Test: `packages/agent/src/conversationRecorder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createConversationRecorder } from './conversationRecorder.js';

describe('ConversationRecorder', () => {
  it('accumulates turns and reports counts', () => {
    const r = createConversationRecorder({ sessionId: 's1', startMs: 1000 });
    r.addTurn('user', 'hi');
    r.addTurn('agent', 'hello');
    r.addTurn('user', 'show me a calmer');
    const tags = r.finish({ mode: 'voice', nowMs: 4000 });
    expect(tags.session_id).toBe('s1');
    expect(tags.mode).toBe('voice');
    expect(tags.turns).toBe(3);
    expect(tags.duration_sec).toBe(3);
    expect(tags.outcome).toBe('abandoned');
    expect((tags.transcript as unknown[]).length).toBe(3);
  });

  it('marks purchased outcome and attributed cents', () => {
    const r = createConversationRecorder({ sessionId: 's2', startMs: 0 });
    r.addTurn('user', 'buy it');
    r.markCartAdd();
    r.markCheckoutReached();
    r.markPurchased(25000);
    const tags = r.finish({ mode: 'text', nowMs: 1000 });
    expect(tags.outcome).toBe('purchased');
    expect(tags.attributed_cents).toBe(25000);
    expect(tags.cart_adds).toBe(1);
    expect(tags.checkout_reached).toBe(true);
  });

  it('ignores empty turns', () => {
    const r = createConversationRecorder({ sessionId: 's3', startMs: 0 });
    r.addTurn('user', '   ');
    const tags = r.finish({ mode: 'text', nowMs: 0 });
    expect(tags.turns).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shoppingmate/agent vitest run conversationRecorder`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/agent/src/conversationRecorder.ts
export type TranscriptRole = 'user' | 'agent' | 'tool' | 'card';
export type TranscriptTurn = { role: TranscriptRole; content: string; timestamp: number };

export type ConversationTags = {
  session_id: string;
  mode: 'voice' | 'text';
  duration_sec: number;
  turns: number;
  outcome: 'purchased' | 'abandoned';
  attributed_cents: number;
  cart_adds: number;
  checkout_reached: boolean;
  transcript: TranscriptTurn[];
};

export type ConversationRecorder = {
  addTurn: (role: TranscriptRole, content: string) => void;
  markCartAdd: () => void;
  markCheckoutReached: () => void;
  markPurchased: (cents: number) => void;
  finish: (args: { mode: 'voice' | 'text'; nowMs: number }) => ConversationTags;
};

export function createConversationRecorder(args: {
  sessionId: string;
  startMs: number;
}): ConversationRecorder {
  const turns: TranscriptTurn[] = [];
  let cartAdds = 0;
  let checkoutReached = false;
  let purchased = false;
  let attributedCents = 0;

  return {
    addTurn(role, content) {
      if (!content || content.trim().length === 0) return;
      turns.push({ role, content, timestamp: Date.now() - args.startMs });
    },
    markCartAdd() {
      cartAdds += 1;
    },
    markCheckoutReached() {
      checkoutReached = true;
    },
    markPurchased(cents) {
      purchased = true;
      attributedCents = Math.max(0, Math.round(cents));
    },
    finish({ mode, nowMs }) {
      return {
        session_id: args.sessionId,
        mode,
        duration_sec: Math.max(0, Math.round((nowMs - args.startMs) / 1000)),
        turns: turns.length,
        outcome: purchased ? 'purchased' : 'abandoned',
        attributed_cents: attributedCents,
        cart_adds: cartAdds,
        checkout_reached: checkoutReached,
        transcript: turns,
      };
    },
  };
}
```

Note: `addTurn` uses `Date.now()` for per-turn timestamps but `finish` takes `nowMs` so duration is deterministic in tests. The test passes `startMs` and asserts on counts/duration, not per-turn timestamps.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @shoppingmate/agent vitest run conversationRecorder`
Expected: PASS (3 tests).

- [ ] **Step 5: Export + commit**

Add `export * from './conversationRecorder.js';` to `packages/agent/src/index.ts`.

```bash
git add packages/agent/src/conversationRecorder.ts packages/agent/src/conversationRecorder.test.ts packages/agent/src/index.ts
git commit -m "feat(agent): ConversationRecorder for conversationCompleted emission"
```

### Task 2: Register new metric names

**Files:** Modify `packages/db/src/schema/metricEvents.ts`

- [ ] **Step 1: Add names to the `metricNames` map**

```ts
  conversationCompleted: 'conversationCompleted',
  voiceConversation: 'voiceConversation',
  cartAdd: 'cart.add',
  checkoutReached: 'checkout.reached',
```

(`conversationCompleted`/`voiceConversation` use the literals the existing readers already query.)

- [ ] **Step 2: Build + commit**

Run: `pnpm --filter @shoppingmate/db build`
Expected: succeeds.

```bash
git add packages/db/src/schema/metricEvents.ts
git commit -m "feat(db): register conversation + funnel metric names"
```

### Task 3: Emit conversationCompleted from the voice worker

**Files:** Modify `apps/voice-agent/src/agentWorker.ts`

- [ ] **Step 1: Construct a recorder after `merchant` is resolved** (near line 200, after `visitorId`)

```ts
const recorder = createConversationRecorder({ sessionId, startMs: Date.now() });
const isVoice = true;
```

Add `createConversationRecorder` to the `@shoppingmate/agent` import block (lines 16-24).

- [ ] **Step 2: Record visitor + bot turns in `gemini.onEvent`**

In the `final_transcript` branch (after line 433 `dataChannel.publish({ type: 'user_text', text: e.text });`):
```ts
recorder.addTurn('user', e.text);
```
In the `bot_text` branch (after line 460 `dataChannel.publish({ type: 'say', text: e.text });`):
```ts
recorder.addTurn('agent', e.text);
```

- [ ] **Step 3: Mark funnel/outcome from host-action results**

In the early `DataReceived` handler where `host_action_result` is delivered to the bridge (line 300-302), inspect the action result is not enough (no action type there). Instead, mark in the bridge `publishData` callback where `host_action_request` is forwarded (line 382-388): before `dataChannel.publish(msg)`, add:
```ts
if (msg.type === 'host_action_request') {
  if (msg.action.type === 'cart_add') recorder.markCartAdd();
  if (msg.action.type === 'navigate' && String(msg.action.path).includes('/checkout')) recorder.markCheckoutReached();
}
if (msg.type === 'checkout_redirect') recorder.markCheckoutReached();
```

- [ ] **Step 4: Emit on Disconnect** (inside the `RoomEvent.Disconnected` handler, line 520-532, after `closeSession`)

```ts
const tags = recorder.finish({ mode: 'voice', nowMs: Date.now() });
db.insert(schema.metricEvents)
  .values({ merchantId: merchant.id, metricName: 'conversationCompleted', tags })
  .then(() => {
    if (isVoice) {
      return db.insert(schema.metricEvents).values({
        merchantId: merchant.id,
        metricName: 'voiceConversation',
        tags: { session_id: sessionId },
      });
    }
  })
  .catch((err) => log.warn({ err, sessionId }, 'conversationCompleted emit failed'));
```

- [ ] **Step 5: Build + commit**

Run: `pnpm --filter @shoppingmate/voice-agent build` (or root `pnpm -r build --filter voice-agent`)
Expected: compiles.

```bash
git add apps/voice-agent/src/agentWorker.ts
git commit -m "feat(voice): emit conversationCompleted + voiceConversation with transcript"
```

### Task 4: Emit conversationCompleted from the text WS

**Files:** Modify `apps/api/src/index.ts`

- [ ] **Step 1: Track a recorder per session**

Near `pendingHostActions` (line 98), add:
```ts
const recorders = new Map<string, import('@shoppingmate/agent').ConversationRecorder>();
```
Add `createConversationRecorder` + `ConversationRecorder` to the `@shoppingmate/agent` import (lines 10-21).

- [ ] **Step 2: Record visitor text on user_text**

After `session` is created/loaded and `msg.type === 'user_text'` (just before `runTurn`, ~line 224), ensure a recorder exists and add the turn:
```ts
let recorder = recorders.get(sessionId);
if (!recorder) {
  recorder = createConversationRecorder({ sessionId, startMs: Date.now() });
  recorders.set(sessionId, recorder);
}
if (msg.type === 'user_text') recorder.addTurn('user', msg.text);
```

- [ ] **Step 3: Record bot say events + funnel in the stream loop**

Replace the `for await` loop (line 225-227) with:
```ts
for await (const ev of runTurn(deps, merchant, session, msg)) {
  if (ev.type === 'say' && ev.text) recorder.addTurn('agent', ev.text);
  if (ev.type === 'host_action_request') {
    if (ev.action.type === 'cart_add') recorder.markCartAdd();
    if (ev.action.type === 'navigate' && String(ev.action.path).includes('/checkout')) recorder.markCheckoutReached();
  }
  if (ev.type === 'checkout_redirect') recorder.markCheckoutReached();
  send(encodeAgentEvent(ev));
}
```

- [ ] **Step 4: Emit on session_end**

In the `msg.type === 'session_end'` branch (line 146-155), before `send(...session_closed...)`:
```ts
const rec = recorders.get(sessionId);
if (rec) {
  recorders.delete(sessionId);
  const tags = rec.finish({ mode: 'text', nowMs: Date.now() });
  db.insert(schema.metricEvents)
    .values({ merchantId, metricName: 'conversationCompleted', tags })
    .catch((err) => logger.warn({ err, sessionId }, 'conversationCompleted emit failed'));
}
```

- [ ] **Step 5: Build + commit**

Run: `pnpm --filter @shoppingmate/api build`
Expected: compiles.

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): emit conversationCompleted with transcript on session_end"
```

---

## Phase 2 — Funnel metrics + COD conversion

### Task 5: Emit funnel metrics in the shared runtime

**Files:** Modify `packages/agent/src/runtime.ts`

- [ ] **Step 1: Emit cart.add / checkout.reached at host-action dispatch**

In the site-tool branch (around line 322-349, where `toHostAction` + `dispatchHostAction` run), after a successful dispatch:
```ts
const action = toHostAction(call.name, args);
const result = await deps.dispatchHostAction(action);
if (result.ok) {
  if (action.type === 'cart_add') {
    await deps.recordMetric('cart.add', { sku: action.sku, qty: action.qty });
  }
  if (action.type === 'navigate' && action.path.includes('/checkout')) {
    await deps.recordMetric('checkout.reached', { source: 'navigate' });
  }
}
```
And in the `checkout.url` success branch (line 397-398):
```ts
if (envelope.ok && call.name === 'checkout.url' && typeof envelope.value === 'string') {
  await deps.recordMetric('checkout.reached', { source: 'checkout_url' });
  yield { type: 'checkout_redirect', url: envelope.value };
}
```

- [ ] **Step 2: Add/extend a runtime test**

In `packages/agent/src/runtime.test.ts` (or a focused new test), assert that a `cart_add` tool call with `result.ok` triggers `recordMetric('cart.add', ...)`. Use the existing test harness's mock `recordMetric` + `dispatchHostAction`. (Mirror an existing runtime test's setup.)

- [ ] **Step 3: Run + commit**

Run: `pnpm --filter @shoppingmate/agent vitest run runtime`
Expected: PASS.

```bash
git add packages/agent/src/runtime.ts packages/agent/src/runtime.test.ts
git commit -m "feat(agent): emit cart.add + checkout.reached funnel metrics"
```

### Task 6: Allow COD conversion source

**Files:** Modify `apps/api/src/services/attributeOrder.ts`, `packages/db/src/schema/conversionEvents.ts`, `apps/api/src/routes/conversion.ts`

- [ ] **Step 1: Widen the matchSource union**

In `attributeOrder.ts` change `matchSource: 'shopify_webhook' | 'gtag';` → `matchSource: 'shopify_webhook' | 'gtag' | 'cod';`.
In `conversionEvents.ts` update the `matchSource` comment to include `'cod'`.

- [ ] **Step 2: Honor payload.matchSource in the conversion route**

In `conversion.ts`, change the order builder `matchSource: 'gtag',` to:
```ts
matchSource: payload.matchSource === 'cod' ? 'cod' : 'gtag',
```
and the telemetry `source: 'gtag'` tags to `source: payload.matchSource === 'cod' ? 'cod' : 'gtag'`.

- [ ] **Step 3: Add a test**

In `apps/api/src/routes/conversion.test.ts` add a case posting `matchSource: 'cod'` with a valid HMAC, asserting the `attribute` mock receives `matchSource: 'cod'`. (Mirror the existing gtag test's HMAC setup.)

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @shoppingmate/api vitest run conversion`
Expected: PASS.

```bash
git add apps/api/src/services/attributeOrder.ts packages/db/src/schema/conversionEvents.ts apps/api/src/routes/conversion.ts apps/api/src/routes/conversion.test.ts
git commit -m "feat(api): accept COD conversion source"
```

---

## Phase 3 — Audit ledger page

### Task 7: audit-repo (TDD)

**Files:** Create `web/src/lib/audit-repo.ts`, `web/src/lib/audit-repo.test.ts`

- [ ] **Step 1: Write the failing test** (mock `@/lib/db` like existing repo tests)

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const rows = [
  { id: 1, orderId: 'O1', totalCents: 25000, currency: 'INR', attributionKind: 'assisted', matchSource: 'cod', occurredAt: new Date('2026-06-14'), sessionId: 's1', lineItems: [{ sku: 'CALM-1', quantity: 1, priceCents: 25000, wasRecommended: true }] },
];
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }) }) }) },
}));

import { listConversions } from './audit-repo';

describe('audit-repo', () => {
  it('returns ledger rows', async () => {
    const out = await listConversions({ merchantId: 'SM-X', days: 30 });
    expect(out).toHaveLength(1);
    expect(out[0].orderId).toBe('O1');
    expect(out[0].matchSource).toBe('cod');
  });
});
```

- [ ] **Step 2: Run → fail.** `cd web && pnpm vitest run audit-repo` → FAIL (no module).

- [ ] **Step 3: Implement**

```ts
// web/src/lib/audit-repo.ts
import { db } from './db';
import { conversionEvents } from '@shoppingmate/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export type LedgerRow = {
  id: number;
  orderId: string;
  totalCents: number;
  currency: string;
  attributionKind: string;
  matchSource: string;
  occurredAt: Date;
  sessionId: string | null;
  lineItems: { sku: string; quantity: number; priceCents: number; wasRecommended: boolean }[];
};

export async function listConversions(args: { merchantId: string; days: number }): Promise<LedgerRow[]> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: conversionEvents.id,
      orderId: conversionEvents.orderId,
      totalCents: conversionEvents.totalCents,
      currency: conversionEvents.currency,
      attributionKind: conversionEvents.attributionKind,
      matchSource: conversionEvents.matchSource,
      occurredAt: conversionEvents.occurredAt,
      sessionId: conversionEvents.sessionId,
      lineItems: conversionEvents.lineItems,
    })
    .from(conversionEvents)
    .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since)))
    .orderBy(desc(conversionEvents.occurredAt))
    .limit(500);
  return rows as LedgerRow[];
}
```

- [ ] **Step 4: Run → pass.** `cd web && pnpm vitest run audit-repo` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add web/src/lib/audit-repo.ts web/src/lib/audit-repo.test.ts
git commit -m "feat(web): audit-repo conversions ledger query"
```

### Task 8: Audit page + nav

**Files:** Create `web/src/app/app/audit/page.tsx`; Modify `web/src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Add nav entry** in `Sidebar.tsx` `NAV` after Conversations:
```ts
  { href: '/app/audit', label: 'Audit' },
```

- [ ] **Step 2: Create the page** (RSC, mirrors conversations/page.tsx)

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConversions } from '@/lib/audit-repo';

export default async function AuditPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConversions({ merchantId: session.merchant.id, days: 30 });
  const money = (c: number, cur: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(c / 100);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Audit · conversions ledger</h1>
      <p className="text-sm text-text-secondary">Every order the assistant influenced or placed in the last 30 days.</p>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">No conversions recorded yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-text-secondary">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Attribution</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-text-secondary">{r.occurredAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.orderId}</td>
                  <td className="px-4 py-2 capitalize">{r.attributionKind}</td>
                  <td className="px-4 py-2 uppercase text-xs">{r.matchSource}</td>
                  <td className="px-4 py-2">{r.lineItems?.length ?? 0}</td>
                  <td className="px-4 py-2 text-right font-medium">{money(r.totalCents, r.currency)}</td>
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

- [ ] **Step 3: Update Sidebar test** if it snapshots NAV length; run `cd web && pnpm vitest run Sidebar`.

- [ ] **Step 4: Commit.**
```bash
git add web/src/app/app/audit/page.tsx web/src/components/dashboard/Sidebar.tsx web/src/components/dashboard/Sidebar.test.tsx
git commit -m "feat(web): audit conversions ledger page + nav"
```

---

## Phase 4 — Funnel widget

### Task 9: funnel-repo (TDD)

**Files:** Create `web/src/lib/funnel-repo.ts`, `web/src/lib/funnel-repo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
const metricRows = [
  { name: 'conversationCompleted', count: 100 },
  { name: 'cart.add', count: 40 },
  { name: 'checkout.reached', count: 25 },
];
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ groupBy: () => Promise.resolve(metricRows) }) }) }) },
}));
import { computeFunnel } from './funnel-repo';
describe('funnel-repo', () => {
  it('computes steps + rates', async () => {
    const f = await computeFunnel({ merchantId: 'SM-X', days: 7, purchases: 10 });
    expect(f.conversations).toBe(100);
    expect(f.cartAdds).toBe(40);
    expect(f.checkoutReached).toBe(25);
    expect(f.purchases).toBe(10);
    expect(f.cartRate).toBeCloseTo(0.4);
    expect(f.checkoutRate).toBeCloseTo(0.25);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```ts
// web/src/lib/funnel-repo.ts
import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type Funnel = {
  conversations: number; cartAdds: number; checkoutReached: number; purchases: number;
  cartRate: number; checkoutRate: number; purchaseRate: number;
};

export async function computeFunnel(args: { merchantId: string; days: number; purchases: number }): Promise<Funnel> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({ name: metricEvents.metricName, count: sql<number>`count(*)::int` })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.ts, since)))
    .groupBy(metricEvents.metricName);
  const by = new Map(rows.map((r) => [r.name, r.count]));
  const conversations = by.get('conversationCompleted') ?? 0;
  const cartAdds = by.get('cart.add') ?? 0;
  const checkoutReached = by.get('checkout.reached') ?? 0;
  const purchases = args.purchases;
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    conversations, cartAdds, checkoutReached, purchases,
    cartRate: rate(cartAdds, conversations),
    checkoutRate: rate(checkoutReached, conversations),
    purchaseRate: rate(purchases, conversations),
  };
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit.**
```bash
git add web/src/lib/funnel-repo.ts web/src/lib/funnel-repo.test.ts
git commit -m "feat(web): funnel-repo aggregation"
```

### Task 10: FunnelCard + Home wiring

**Files:** Create `web/src/components/dashboard/FunnelCard.tsx`; Modify `web/src/app/app/page.tsx`

- [ ] **Step 1: FunnelCard component**

```tsx
import type { Funnel } from '@/lib/funnel-repo';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const steps = [
    { label: 'Conversations', value: funnel.conversations, rate: null as number | null },
    { label: 'Added to cart', value: funnel.cartAdds, rate: funnel.cartRate },
    { label: 'Reached checkout', value: funnel.checkoutReached, rate: funnel.checkoutRate },
    { label: 'Purchased', value: funnel.purchases, rate: funnel.purchaseRate },
  ];
  const max = Math.max(funnel.conversations, 1);
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5">
      <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">Bot-driven funnel · 7d</h2>
      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-text-secondary">{s.label}</span>
              <span className="font-medium text-text-primary">{s.value}{s.rate != null ? ` · ${pct(s.rate)}` : ''}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted">
              <div className="h-2 rounded-full bg-violet" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into Home** (`web/src/app/app/page.tsx`): import `computeFunnel` + `FunnelCard`, compute after `kpis` using `purchases: kpis.assistedOrderCount + kpis.influencedOrderCount`, and render `<FunnelCard funnel={funnel} />` above `<ConversationsTable>`.

- [ ] **Step 3: Build + commit.**

Run: `cd web && pnpm vitest run` (no regressions).
```bash
git add web/src/components/dashboard/FunnelCard.tsx web/src/app/app/page.tsx
git commit -m "feat(web): bot-driven funnel card on home"
```

---

## Phase 5 — Live view

### Task 11: /api/live route (TDD)

**Files:** Create `web/src/app/api/live/route.ts`, `web/src/app/api/live/route.test.ts`

- [ ] **Step 1: Failing test** (mock session + db, mirror portal-session test)

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('@/lib/session', () => ({ getDashboardSession: vi.fn().mockResolvedValue({ merchant: { id: 'SM-X' } }) }));
vi.mock('@/lib/live-repo', () => ({ liveSnapshot: vi.fn().mockResolvedValue({ activeConversations: 2, conversionsToday: 1, revenueTodayCents: 25000 }) }));
import { GET } from './route';
describe('GET /api/live', () => {
  it('returns snapshot', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).activeConversations).toBe(2);
  });
  it('401 without session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** `web/src/lib/live-repo.ts`:

```ts
import { db } from './db';
import { conversationSessions, conversionEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';

export async function liveSnapshot(merchantId: string) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const [active, conv] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(conversationSessions)
      .where(and(eq(conversationSessions.merchantId, merchantId), isNull(conversationSessions.endedAt))),
    db.select({ n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${conversionEvents.totalCents}),0)::int` })
      .from(conversionEvents)
      .where(and(eq(conversionEvents.merchantId, merchantId), gte(conversionEvents.occurredAt, startOfDay))),
  ]);
  return {
    activeConversations: active[0]?.n ?? 0,
    conversionsToday: conv[0]?.n ?? 0,
    revenueTodayCents: conv[0]?.cents ?? 0,
  };
}
```

and `web/src/app/api/live/route.ts`:
```ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { liveSnapshot } from '@/lib/live-repo';

export async function GET() {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await liveSnapshot(session.merchant.id));
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit.**
```bash
git add web/src/lib/live-repo.ts web/src/app/api/live/route.ts web/src/app/api/live/route.test.ts
git commit -m "feat(web): /api/live snapshot endpoint"
```

### Task 12: LivePanel + Home wiring

**Files:** Create `web/src/components/dashboard/LivePanel.tsx`; Modify `web/src/app/app/page.tsx`

- [ ] **Step 1: Client component polling every 10s**

```tsx
'use client';
import { useEffect, useState } from 'react';

type Snapshot = { activeConversations: number; conversionsToday: number; revenueTodayCents: number };

export function LivePanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/live').then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setSnap(d); }).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const money = (c: number) => `$${(c / 100).toFixed(0)}`;
  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" /></span>
        <h2 className="font-display text-lg font-semibold text-text-primary">Live now</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div><div className="text-2xl font-semibold">{snap?.activeConversations ?? '—'}</div><div className="text-xs text-text-secondary">Active chats</div></div>
        <div><div className="text-2xl font-semibold">{snap?.conversionsToday ?? '—'}</div><div className="text-xs text-text-secondary">Orders today</div></div>
        <div><div className="text-2xl font-semibold">{snap ? money(snap.revenueTodayCents) : '—'}</div><div className="text-xs text-text-secondary">Revenue today</div></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render `<LivePanel />`** at the top of Home (`web/src/app/app/page.tsx`), above the KPI grid.

- [ ] **Step 3: Build + commit.**

Run: `cd web && pnpm vitest run` (green).
```bash
git add web/src/components/dashboard/LivePanel.tsx web/src/app/app/page.tsx
git commit -m "feat(web): live-now panel on home (10s poll)"
```

---

## Phase 6 — Verification & evidence

### Task 13: Full verification pass

- [ ] **Step 1:** `cd web && pnpm vitest run` → all green (record count, expect 71 + new tests).
- [ ] **Step 2:** `pnpm -r typecheck` → clean.
- [ ] **Step 3:** `pnpm -r build` (or per-package builds for agent/api/voice-agent/web) → clean.
- [ ] **Step 4 (live, if DB creds available):** drive a real Calmosis bot conversation (recommend → cart.add → checkout nav → COD order) and confirm via the check scripts:
  - `node apps/api/scripts/check-calmosis-metrics.mjs <merchantId>` shows `conversationCompleted`, `cart.add`, `checkout.reached`.
  - the Audit page lists the COD conversion; the funnel + live panel reflect it.
- [ ] **Step 5:** append results to `docs/runbooks/2026-06-15-calmosis-dashboard-verification.md` and commit (per "prove with logs").

---

## Self-review notes

- **Spec coverage:** C1 verification → Tasks 0, 13. C2 transcripts → Tasks 1-4 (reuse conversationCompleted). C3 funnel+COD → Tasks 5-6. C4 audit ledger → Tasks 7-8. C5 funnel surface → Tasks 9-10. C6 live → Tasks 11-12. ✅
- **Type consistency:** `ConversationRecorder`/`ConversationTags` defined in Task 1, used in 3-4. `Funnel` in 9 used in 10. `liveSnapshot` shape in 11 used in 12. `LedgerRow` in 7 used in 8. ✅
- **Known follow-up (not a blocker):** COD conversions require the Calmosis frontend to POST `/v1/conversion` with `matchSource: 'cod'` (HMAC-signed) after a successful COD order. Task 6 readies the receiver; the frontend snippet lives in the calmosis-v1-frontend repo and is documented in the verification runbook.
