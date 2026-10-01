# Razorpay Billing Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Stripe billing rail in `web/` with Razorpay (subscriptions + top-up payment links + in-app cancel), keeping the Stripe code dormant for rollback.

**Architecture:** Mirror the existing Stripe handlers in-code. Razorpay Subscriptions (hosted `short_url`) for plans, Payment Links (hosted `short_url`) for top-ups, an in-app cancel route (Razorpay has no hosted portal), and a signature-verified webhook idempotent on the `X-Razorpay-Event-Id` header. New DB columns + a `razorpay_events` table parallel the Stripe ones.

**Tech Stack:** Next.js (App Router, route handlers), `razorpay` Node SDK, Drizzle ORM + Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-razorpay-billing-migration-design.md`

**Branch:** `feat/razorpay-billing` (already checked out).

**Note — run commands in the PowerShell tool, not Bash** (node is unreliable under the Bash tool on this Windows box, per `reference_dev_environment_quirks`).

---

## File structure

| File | Responsibility |
|---|---|
| `web/src/lib/razorpay.ts` (new) | Lazy client + `PLAN_IDS` + `TOPUP_AMOUNTS` + `TOPUP_QTYS` + `validateWebhookSignature` + `BILLING_CURRENCY` |
| `web/src/app/api/billing/checkout-session/route.ts` (swap) | Create subscription → return `short_url` |
| `web/src/app/api/billing/topup/route.ts` (swap) | Create payment link → return `short_url` |
| `web/src/app/api/billing/cancel/route.ts` (new) | Cancel subscription at cycle end (replaces portal) |
| `web/src/app/api/billing/portal-session/route.ts` (delete) | — removed |
| `web/src/app/api/webhooks/razorpay/route.ts` (new) | Verify sig, idempotency, handle events |
| `web/src/app/app/billing/page.tsx` (edit) | Invoices via Razorpay; "Manage billing" → cancel |
| `packages/db/src/schema/merchants.ts` (edit) | `razorpay_customer_id`, `razorpay_subscription_id` |
| `packages/db/src/schema/dashboard.ts` (edit) | `razorpay_events` table |
| `web/scripts/create-razorpay-plans.ts` (new) | One-off: create 3 plans, print `plan_xxx` ids |

---

## Task 1: Add the `razorpay` dependency + plan-creation script

**Files:**
- Modify: `web/package.json` (deps)
- Create: `web/scripts/create-razorpay-plans.ts`

- [ ] **Step 1: Install the SDK + tsx runner**

Run (PowerShell):
```
pnpm --filter web add razorpay
pnpm --filter web add -D tsx
```
Expected: `razorpay` added to `dependencies`, `tsx` to `devDependencies`; lockfile updated.

- [ ] **Step 2: Write the plan-creation script**

Create `web/scripts/create-razorpay-plans.ts`:
```ts
import Razorpay from 'razorpay';

// One-off. Run once per Razorpay account (test, then live):
//   RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... BILLING_CURRENCY=USD \
//   pnpm --filter web exec tsx scripts/create-razorpay-plans.ts
// Paste the printed RAZORPAY_PLAN_* lines into the service env.

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
const currency = process.env.BILLING_CURRENCY ?? 'USD';

const plans = [
  { key: 'STARTER', name: 'shoppingmate Starter', amount: 3000 }, // $30.00
  { key: 'GROWTH', name: 'shoppingmate Growth', amount: 9900 }, // $99.00
  { key: 'SCALE', name: 'shoppingmate Scale', amount: 29900 }, // $299.00
];

for (const p of plans) {
  const plan = await rzp.plans.create({
    period: 'monthly',
    interval: 1,
    item: { name: p.name, amount: p.amount, currency },
  });
  console.log(`RAZORPAY_PLAN_${p.key}=${plan.id}`);
}
```

- [ ] **Step 3: Commit**

```
git add web/package.json web/pnpm-lock.yaml pnpm-lock.yaml web/scripts/create-razorpay-plans.ts
git commit -m "feat(billing): add razorpay sdk + plan-creation script"
```
(Only the lockfile that actually changed exists — drop the missing path from `git add` if it errors.)

---

## Task 2: `lib/razorpay.ts`

**Files:**
- Create: `web/src/lib/razorpay.ts`
- Test: `web/src/lib/razorpay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/razorpay.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { razorpay, PLAN_IDS, TOPUP_AMOUNTS, TOPUP_QTYS } from './razorpay';

describe('razorpay wrapper', () => {
  it('exports a Razorpay client with subscriptions + paymentLink', () => {
    expect(razorpay).toBeDefined();
    expect(typeof razorpay.subscriptions.create).toBe('function');
    expect(typeof razorpay.paymentLink.create).toBe('function');
  });

  it('exports PLAN_IDS for the three plans', () => {
    expect(PLAN_IDS.starter).toBeDefined();
    expect(PLAN_IDS.growth).toBeDefined();
    expect(PLAN_IDS.scale).toBeDefined();
  });

  it('exports TOPUP_AMOUNTS + TOPUP_QTYS for all packs', () => {
    expect(TOPUP_AMOUNTS.topup_50.amount).toBe(1900);
    expect(TOPUP_AMOUNTS.topup_5000.label).toBe('5,000');
    expect(TOPUP_QTYS.topup_200).toBe(200);
    expect(TOPUP_QTYS.topup_1000).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/lib/razorpay.test.ts`
Expected: FAIL — cannot find module `./razorpay`.

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/razorpay.ts`:
```ts
import Razorpay from 'razorpay';

let _rzp: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (_rzp) return _rzp;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set');
  _rzp = new Razorpay({ key_id, key_secret });
  return _rzp;
}

export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    const client = getRazorpay();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

// HMAC-SHA256 verification (static on the SDK). Cast — the type isn't exported.
export function validateWebhookSignature(body: string, signature: string, secret: string): boolean {
  const rz = Razorpay as unknown as {
    validateWebhookSignature: (b: string, s: string, sec: string) => boolean;
  };
  return rz.validateWebhookSignature(body, signature, secret);
}

export const PLAN_IDS = {
  starter: process.env.RAZORPAY_PLAN_STARTER ?? '',
  growth: process.env.RAZORPAY_PLAN_GROWTH ?? '',
  scale: process.env.RAZORPAY_PLAN_SCALE ?? '',
} as const;

export const BILLING_CURRENCY = process.env.BILLING_CURRENCY ?? 'USD';

export type TopupKey = 'topup_50' | 'topup_200' | 'topup_1000' | 'topup_5000';

// Charge amount in the smallest currency unit (cents/paise).
export const TOPUP_AMOUNTS: Record<TopupKey, { amount: number; label: string }> = {
  topup_50: { amount: 1900, label: '50' },
  topup_200: { amount: 5900, label: '200' },
  topup_1000: { amount: 19900, label: '1,000' },
  topup_5000: { amount: 79900, label: '5,000' },
};

// Conversations credited to topupBalance when a pack is paid.
export const TOPUP_QTYS: Record<TopupKey, number> = {
  topup_50: 50,
  topup_200: 200,
  topup_1000: 1000,
  topup_5000: 5000,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/lib/razorpay.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
git add web/src/lib/razorpay.ts web/src/lib/razorpay.test.ts
git commit -m "feat(billing): razorpay client wrapper + plan/topup maps"
```

---

## Task 3: DB schema — columns + `razorpay_events` table

**Files:**
- Modify: `packages/db/src/schema/merchants.ts:71-72` (add two columns after the Stripe ones)
- Modify: `packages/db/src/schema/dashboard.ts:57-71` (add table + type)
- Test: `packages/db/test/schema/merchants-dashboard.test.ts`, `packages/db/test/schema/dashboard.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/db/test/schema/merchants-dashboard.test.ts`, add inside `describe('merchants dashboard columns', ...)`:
```ts
  it('has Razorpay billing columns', () => {
    expect(merchants.razorpayCustomerId).toBeDefined();
    expect(merchants.razorpaySubscriptionId).toBeDefined();
  });
```

In `packages/db/test/schema/dashboard.test.ts`, update the import to add `razorpayEvents`:
```ts
import {
  merchantOwners,
  brandKbDocuments,
  brandKbChunks,
  alerts,
  stripeEvents,
  razorpayEvents,
} from '../../src/schema/dashboard';
```
and add inside `describe('dashboard schema', ...)`:
```ts
  it('razorpayEvents has idempotency columns', () => {
    expect(razorpayEvents.id).toBeDefined();
    expect(razorpayEvents.type).toBeDefined();
    expect(razorpayEvents.receivedAt).toBeDefined();
    expect(razorpayEvents.processedAt).toBeDefined();
    expect(razorpayEvents.payload).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @shoppingmate/db exec vitest run test/schema/dashboard.test.ts test/schema/merchants-dashboard.test.ts`
Expected: FAIL — `razorpayEvents` is not exported; `merchants.razorpayCustomerId` is undefined.

- [ ] **Step 3: Add the columns**

In `packages/db/src/schema/merchants.ts`, immediately after line 72 (`stripeSubscriptionId: ...`):
```ts
  razorpayCustomerId: text('razorpay_customer_id').unique(),
  razorpaySubscriptionId: text('razorpay_subscription_id').unique(),
```

- [ ] **Step 4: Add the events table**

In `packages/db/src/schema/dashboard.ts`, after the `stripeEvents` table (line 63), add:
```ts
export const razorpayEvents = pgTable('razorpay_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  payload: jsonb('payload'),
});
```
and after `export type StripeEvent = ...` (line 71):
```ts
export type RazorpayEvent = typeof razorpayEvents.$inferSelect;
```

- [ ] **Step 5: Verify the schema barrel re-exports it**

Confirm `packages/db/src/schema/index.ts` contains `export * from './dashboard.js'` (or equivalent) so `razorpayEvents` reaches `@shoppingmate/db/schema` and the `db.query.razorpayEvents` relational API. If the db client builds its schema object explicitly (`import * as schema`), no change is needed. If it lists tables by name, add `razorpayEvents`.

Run: `pnpm --filter @shoppingmate/db exec vitest run test/schema/dashboard.test.ts test/schema/merchants-dashboard.test.ts`
Expected: PASS.

- [ ] **Step 6: Generate the migration**

Run: `pnpm --filter @shoppingmate/db run db:generate`
Expected: a new `packages/db/drizzle/0019_*.sql` adding `razorpay_customer_id`, `razorpay_subscription_id` to `merchants` and creating `razorpay_events`. Open it and confirm it contains only those changes (no accidental drops).

- [ ] **Step 7: Commit**

```
git add packages/db/src/schema/merchants.ts packages/db/src/schema/dashboard.ts packages/db/test/schema/ packages/db/drizzle/
git commit -m "feat(billing): razorpay db columns + razorpay_events table + migration"
```

---

## Task 4: Swap the checkout-session route to a subscription

**Files:**
- Modify: `web/src/app/api/billing/checkout-session/route.ts` (full rewrite)
- Test: `web/src/app/api/billing/checkout-session/route.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the test**

Replace `web/src/app/api/billing/checkout-session/route.test.ts` with:
```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: null,
  }),
}));

vi.mock('@/lib/razorpay', () => ({
  razorpay: {
    subscriptions: {
      create: vi.fn().mockResolvedValue({ id: 'sub_test', short_url: 'https://rzp.io/i/abc' }),
    },
  },
  PLAN_IDS: { starter: 'plan_test_starter' },
}));

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

import { POST } from './route';

describe('POST /api/billing/checkout-session', () => {
  it('returns Razorpay subscription short_url', async () => {
    const req = new Request('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toContain('rzp.io');
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/billing/checkout-session', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/billing/checkout-session/route.test.ts`
Expected: FAIL — route still imports `@/lib/stripe`.

- [ ] **Step 3: Rewrite the route**

Replace `web/src/app/api/billing/checkout-session/route.ts` with:
```ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { razorpay, PLAN_IDS } from '@/lib/razorpay';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Razorpay collects the customer on its hosted auth page; the customer_id
  // comes back on the subscription.activated webhook. We only carry user_id.
  const subscription = (await razorpay.subscriptions.create({
    plan_id: PLAN_IDS.starter,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: { user_id: session.user.id },
  })) as { id: string; short_url: string };

  return NextResponse.json({ url: subscription.short_url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/app/api/billing/checkout-session/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add web/src/app/api/billing/checkout-session/
git commit -m "feat(billing): checkout-session creates a razorpay subscription"
```

---

## Task 5: Swap the top-up route to a payment link

**Files:**
- Modify: `web/src/app/api/billing/topup/route.ts` (full rewrite)
- Test: `web/src/app/api/billing/topup/route.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the test**

Replace `web/src/app/api/billing/topup/route.test.ts` with:
```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/razorpay', () => ({
  razorpay: {
    paymentLink: { create: vi.fn().mockResolvedValue({ id: 'plink_x', short_url: 'https://rzp.io/i/pl' }) },
  },
  TOPUP_AMOUNTS: {
    topup_50: { amount: 1900, label: '50' },
    topup_200: { amount: 5900, label: '200' },
    topup_1000: { amount: 19900, label: '1,000' },
    topup_5000: { amount: 79900, label: '5,000' },
  },
  BILLING_CURRENCY: 'USD',
}));

import { POST } from './route';

describe('POST /api/billing/topup', () => {
  it('returns a payment-link short_url for a valid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_200' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    const json = await res.json();
    expect(json.url).toContain('rzp.io');
  });

  it('rejects an invalid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_lol' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/billing/topup/route.test.ts`
Expected: FAIL — route still imports `@/lib/stripe`.

- [ ] **Step 3: Rewrite the route**

Replace `web/src/app/api/billing/topup/route.ts` with:
```ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDashboardSession } from '@/lib/session';
import { razorpay, TOPUP_AMOUNTS, BILLING_CURRENCY } from '@/lib/razorpay';

const Body = z.object({ topup_key: z.enum(['topup_50', 'topup_200', 'topup_1000', 'topup_5000']) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid topup_key' }, { status: 400 });

  const pack = TOPUP_AMOUNTS[parsed.data.topup_key];
  const link = (await razorpay.paymentLink.create({
    amount: pack.amount,
    currency: BILLING_CURRENCY,
    accept_partial: false,
    description: `shoppingmate top-up ${pack.label}`,
    reference_id: `topup_${session.merchant.id}_${parsed.data.topup_key}_${Date.now()}`,
    notify: { sms: false, email: true },
    notes: {
      user_id: session.user.id,
      topup_key: parsed.data.topup_key,
      merchant_id: session.merchant.id,
    },
  })) as { id: string; short_url: string };

  return NextResponse.json({ url: link.short_url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/app/api/billing/topup/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add web/src/app/api/billing/topup/
git commit -m "feat(billing): top-up creates a razorpay payment link"
```

---

## Task 6: Replace portal-session with a cancel route

**Files:**
- Create: `web/src/app/api/billing/cancel/route.ts`
- Delete: `web/src/app/api/billing/portal-session/route.ts` and its `route.test.ts`
- Test: `web/src/app/api/billing/cancel/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/app/api/billing/cancel/route.test.ts`:
```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

const cancel = vi.fn().mockResolvedValue({ id: 'sub_x', status: 'cancelled' });
vi.mock('@/lib/razorpay', () => ({ razorpay: { subscriptions: { cancel } } }));

vi.mock('@/lib/db', () => ({
  db: { query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', razorpaySubscriptionId: 'sub_x' }) } } },
}));

import { POST } from './route';

describe('POST /api/billing/cancel', () => {
  it('cancels the subscription at cycle end', async () => {
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(cancel).toHaveBeenCalledWith('sub_x', { cancel_at_cycle_end: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/billing/cancel/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write the route**

Create `web/src/app/api/billing/cancel/route.ts`:
```ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { razorpay } from '@/lib/razorpay';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.razorpaySubscriptionId) return NextResponse.json({ error: 'no subscription' }, { status: 400 });

  await razorpay.subscriptions.cancel(m.razorpaySubscriptionId, { cancel_at_cycle_end: true });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/app/api/billing/cancel/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Delete the portal route + its test**

Run (PowerShell):
```
Remove-Item web/src/app/api/billing/portal-session/route.ts, web/src/app/api/billing/portal-session/route.test.ts
```

- [ ] **Step 6: Commit**

```
git add web/src/app/api/billing/cancel/ web/src/app/api/billing/portal-session/
git commit -m "feat(billing): in-app cancel route replaces stripe portal"
```

---

## Task 7: Razorpay webhook handler

**Files:**
- Create: `web/src/app/api/webhooks/razorpay/route.ts`
- Delete: `web/src/app/api/webhooks/stripe/route.ts` and its `route.test.ts`
- Test: `web/src/app/api/webhooks/razorpay/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/app/api/webhooks/razorpay/route.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { findEvent } = vi.hoisted(() => ({ findEvent: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })) })),
    query: { razorpayEvents: { findFirst: findEvent }, merchants: { findFirst: vi.fn().mockResolvedValue(null) } },
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  },
}));

vi.mock('@/lib/razorpay', () => ({
  validateWebhookSignature: vi.fn().mockReturnValue(true),
  TOPUP_QTYS: { topup_50: 50, topup_200: 200, topup_1000: 1000, topup_5000: 5000 },
}));

import { POST } from './route';

function req(body: object, headers: Record<string, string>) {
  return new Request('http://localhost/api/webhooks/razorpay', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('POST /api/webhooks/razorpay', () => {
  beforeEach(() => findEvent.mockReset());

  it('returns 200 on a signed subscription.activated', async () => {
    findEvent.mockResolvedValue(null);
    const body = { event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_1', customer_id: 'cust_1', notes: { user_id: 'u1' } } } } };
    const res = await POST(req(body, { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(200);
  });

  it('skips already-processed events (idempotent)', async () => {
    findEvent.mockResolvedValue({ id: 'evt_1', processedAt: new Date() });
    const res = await POST(req({ event: 'subscription.activated', payload: {} }, { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).idempotent).toBe(true);
  });

  it('returns 400 when signature header missing', async () => {
    const res = await POST(req({ event: 'x', payload: {} }, { 'x-razorpay-event-id': 'evt_1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature invalid', async () => {
    const { validateWebhookSignature } = await import('@/lib/razorpay');
    vi.mocked(validateWebhookSignature).mockReturnValueOnce(false);
    const res = await POST(req({ event: 'x', payload: {} }, { 'x-razorpay-signature': 'bad', 'x-razorpay-event-id': 'evt_2' }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/app/api/webhooks/razorpay/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write the route**

Create `web/src/app/api/webhooks/razorpay/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateWebhookSignature, TOPUP_QTYS } from '@/lib/razorpay';
import { merchants, merchantOwners, razorpayEvents } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { generateMerchantId } from '@/lib/merchant-id';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('x-razorpay-signature');
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!sig || !eventId) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await req.text();
  let valid = false;
  try {
    valid = validateWebhookSignature(rawBody, sig, process.env.RAZORPAY_WEBHOOK_SECRET!);
  } catch {
    valid = false;
  }
  if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 400 });

  const event = JSON.parse(rawBody) as { event: string; payload: Record<string, { entity: Record<string, unknown> }> };

  // Idempotency keyed on the Razorpay event-id header (no id in the body).
  const existing = await db.query.razorpayEvents.findFirst({ where: eq(razorpayEvents.id, eventId) });
  if (existing?.processedAt) return NextResponse.json({ ok: true, idempotent: true });

  await db
    .insert(razorpayEvents)
    .values({ id: eventId, type: event.event, payload: event as object })
    .onConflictDoNothing();

  switch (event.event) {
    case 'subscription.activated': {
      const sub = event.payload.subscription?.entity as {
        id: string;
        customer_id: string;
        notes?: { user_id?: string };
      };
      const userId = sub?.notes?.user_id;
      if (!userId) break;
      const merchantId = generateMerchantId();
      await db
        .insert(merchants)
        .values({
          id: merchantId,
          domain: `${merchantId.toLowerCase()}.pending`,
          status: 'pending',
          plan: 'starter',
          billingStatus: 'active',
          razorpayCustomerId: sub.customer_id,
          razorpaySubscriptionId: sub.id,
        })
        .onConflictDoNothing();
      await db.insert(merchantOwners).values({ userId, merchantId, role: 'owner' }).onConflictDoNothing();
      break;
    }

    case 'payment_link.paid': {
      const link = event.payload.payment_link?.entity as {
        notes?: { topup_key?: string; merchant_id?: string };
      };
      const topupKey = link?.notes?.topup_key;
      const merchantId = link?.notes?.merchant_id;
      if (topupKey && merchantId) {
        const qty = TOPUP_QTYS[topupKey as keyof typeof TOPUP_QTYS];
        if (qty !== undefined) {
          await db.update(merchants).set({ topupBalance: qty }).where(eq(merchants.id, merchantId));
        }
      }
      break;
    }

    case 'subscription.pending':
    case 'payment.failed': {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (sub?.id) {
        await db.update(merchants).set({ billingStatus: 'past_due' }).where(eq(merchants.razorpaySubscriptionId, sub.id));
        const m = await db.query.merchants.findFirst({ where: eq(merchants.razorpaySubscriptionId, sub.id) });
        if (m) {
          const { createAlert } = await import('@/lib/alerts-repo');
          await createAlert({ merchantId: m.id, kind: 'payment_failed', severity: 'critical', payload: {} });
        }
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = event.payload.subscription?.entity as { id: string } | undefined;
      if (sub?.id) {
        await db.update(merchants).set({ billingStatus: 'canceled' }).where(eq(merchants.razorpaySubscriptionId, sub.id));
      }
      break;
    }
  }

  await db.update(razorpayEvents).set({ processedAt: new Date() }).where(eq(razorpayEvents.id, eventId));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/app/api/webhooks/razorpay/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Delete the Stripe webhook + its test**

Run (PowerShell):
```
Remove-Item web/src/app/api/webhooks/stripe/route.ts, web/src/app/api/webhooks/stripe/route.test.ts
```

- [ ] **Step 6: Commit**

```
git add web/src/app/api/webhooks/razorpay/ web/src/app/api/webhooks/stripe/
git commit -m "feat(billing): razorpay webhook handler replaces stripe"
```

---

## Task 8: Billing page — invoices + cancel button

**Files:**
- Modify: `web/src/app/app/billing/page.tsx:36-40` (invoices) and `:67-69` (button)

This is a server-component UI edit; verification is typecheck + build (no unit test — matches the repo, which does not unit-test RSC pages).

- [ ] **Step 1: Swap the invoice fetch**

In `web/src/app/app/billing/page.tsx`, replace the import `import { stripe } from '@/lib/stripe';` with `import { razorpay } from '@/lib/razorpay';`, and replace the invoice block (lines ~36-40):
```tsx
  let invoices: Array<{ id: string; created: number; total: number; status: string | null; pdf: string | null }> = [];
  if (m?.razorpaySubscriptionId) {
    const list = (await razorpay.invoices.all({ subscription_id: m.razorpaySubscriptionId, count: 12 })) as {
      items: Array<{ id: string; created_at: number; amount: number; status: string | null; short_url: string | null }>;
    };
    invoices = list.items.map((inv) => ({ id: inv.id, created: inv.created_at, total: inv.amount, status: inv.status, pdf: inv.short_url ?? null }));
  }
```
(The render below already divides `total` by 100 and multiplies `created` by 1000 — both correct for Razorpay's paise/cents + epoch-seconds.)

- [ ] **Step 2: Swap the "Manage billing" button to cancel**

Replace the form at lines ~67-69:
```tsx
          <form action="/api/billing/cancel" method="post">
            <Button type="submit" variant="outline">Cancel subscription</Button>
          </form>
          <p className="text-xs text-text-secondary">Cancels at the end of the current billing period. To change plans, cancel and re-subscribe.</p>
```

- [ ] **Step 3: Verify typecheck/build compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no type errors in `billing/page.tsx`, `lib/razorpay.ts`, or the routes.

- [ ] **Step 4: Commit**

```
git add web/src/app/app/billing/page.tsx
git commit -m "feat(billing): billing page reads razorpay invoices + cancel button"
```

---

## Task 9: Full verification + env documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-razorpay-billing-migration-design.md` (tick off, optional)

- [ ] **Step 1: Run the whole web + db test suites**

Run:
```
pnpm --filter web test
pnpm --filter @shoppingmate/db exec vitest run
```
Expected: all green, including the four new/rewritten billing suites. Fix any red before continuing (no `stripe` imports should remain in active code — the dormant `lib/stripe.ts` is fine, but nothing should import it).

- [ ] **Step 2: Confirm no active code imports the deleted Stripe routes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean. If `lib/stripe.ts` or `PRICE_IDS` is referenced anywhere still active, either repoint to razorpay or leave stripe.ts as an unreferenced dormant file (acceptable).

- [ ] **Step 3: Record the live-smoke checklist (deferred until keys + plans + webhook exist)**

The following is the operator go-live gate (NOT part of the test suite, gated on §8 prerequisites):
1. Run `create-razorpay-plans.ts` in **test mode** → paste `RAZORPAY_PLAN_*` into env.
2. Create a **test-mode webhook** → `/api/webhooks/razorpay`, events: `subscription.activated`, `subscription.pending`, `subscription.cancelled`, `subscription.completed`, `payment.failed`, `payment_link.paid` → set `RAZORPAY_WEBHOOK_SECRET`.
3. Subscribe end-to-end on test cards → confirm `subscription.activated` created a merchant + owner with `billingStatus=active`.
4. Buy a top-up → confirm `payment_link.paid` credited `topupBalance`.
5. Capture the server logs as proof (per `feedback_prove_with_logs`).

- [ ] **Step 4: Commit any doc ticks**

```
git add docs/superpowers/
git commit -m "docs(billing): mark razorpay migration implemented; record live-smoke gate"
```

---

## Self-review notes (resolved)

- **Spec coverage:** §2 mapping → Tasks 4/5/7; §3.1 lib → Task 2; §3.4 cancel → Task 6; §3.5 webhook → Task 7; §3.6 page → Task 8; §3.7 DB → Task 3; §3.8 script → Task 1; §6 tests → in every task + Task 9; §7 env → Task 9 Step 3.
- **Type consistency:** `TOPUP_AMOUNTS` (charge) + `TOPUP_QTYS` (credit) + `PLAN_IDS` + `validateWebhookSignature` defined in Task 2 are used with identical shapes in Tasks 5/7. `razorpaySubscriptionId` / `razorpayCustomerId` defined in Task 3 used in Tasks 6/7/8.
- **Known parity choice:** the webhook credits top-ups with `.set({ topupBalance: qty })` (overwrite), matching the current Stripe handler exactly rather than fixing it to increment — out of scope; flag for a later cleanup.
- **Env not yet live:** international card acceptance is gated on Razorpay International activation (§8.2 of the spec) — code is currency-agnostic and ready; live non-INR charging is an operator/KYC step.
