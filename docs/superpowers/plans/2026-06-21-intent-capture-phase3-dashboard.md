# Intent Capture — Phase 3: Dashboard Views

**Goal:** Surface the captured intent in the brand dashboard: intent distribution, top needs, top objections, drop-off by stage, an audience (visitor-profile) list, and per-conversation intent tags.

**Architecture:** Two new repos in `web/src/lib` reading `conversationCompleted.intent` (metric_events) and `visitor_profiles`; a pure `aggregateIntents` reducer (unit-tested, no DB); two new App-Router pages (`/app/intents`, `/app/audience`) + nav items; intent tags added to the existing conversation detail page. Reuse Tailwind cards (mirror `FunnelCard`/`ConversationsTable`). All queries scope by `session.merchant.id`.

**Tech stack:** Next.js App Router (server components), drizzle via `web/src/lib/db.ts` proxy, `@shoppingmate/db/schema`, vitest (happy-dom, `@/` alias, `vi.mock('./db')`).

Verified terrain: pages under `web/src/app/app/*`; nav `web/src/components/dashboard/Sidebar.tsx:8` (`BASE_NAV`); merchant scope `getDashboardSession({headers})` → `session.merchant.id` (`web/src/lib/session.ts`); repo template `web/src/lib/conversations-repo.ts` (drizzle, `sql\`${metricEvents.tags}->>'x'\``); detail page `web/src/app/app/conversations/[id]/page.tsx` + `getConversation()` reads whole `tags`; visitor_profiles importable via `@shoppingmate/db/schema` (`visitorProfiles`); cards in `web/src/components/dashboard/*` + `web/src/components/ui/card.tsx`; test pattern `web/src/lib/kpi-repo.test.ts` (`vi.mock('./db')`).

---

### Task 1: pure `aggregateIntents` reducer + test (data, no DB)

**Files:** Create `web/src/lib/intent-insights.ts` + `intent-insights.test.ts`.

```ts
// web/src/lib/intent-insights.ts
export type IntentTagRow = {
  intent: string | null;
  outcome: string | null;
  needs: string[];
  objections: string[];
  dropStage: string | null;
};
export type Counted = { key: string; count: number };
export type IntentInsights = {
  total: number;
  distribution: Counted[];   // by primary intent, desc
  topNeeds: Counted[];       // desc
  topObjections: Counted[];  // desc
  dropStages: Counted[];     // abandoned only, desc
};

const tally = (items: string[]): Counted[] => {
  const m = new Map<string, number>();
  for (const raw of items) {
    const k = (raw ?? '').trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

export function aggregateIntents(rows: IntentTagRow[]): IntentInsights {
  return {
    total: rows.length,
    distribution: tally(rows.map((r) => r.intent ?? 'unknown')),
    topNeeds: tally(rows.flatMap((r) => r.needs ?? [])),
    topObjections: tally(rows.flatMap((r) => r.objections ?? [])),
    dropStages: tally(rows.filter((r) => r.outcome === 'abandoned').map((r) => r.dropStage ?? '').filter(Boolean)),
  };
}
```

Test: build ~4 rows (2 ready_to_buy, 1 price_sensitive, 1 abandoned with dropStage 'checkout'; overlapping needs); assert distribution sorted desc, topNeeds counts, dropStages only counts abandoned. Run `npx vitest run web/src/lib/intent-insights.test.ts` (from repo root).

---

### Task 2: `intent-repo.ts` (query + aggregate) + test

**Files:** Create `web/src/lib/intent-repo.ts` + `intent-repo.test.ts`.

```ts
import { and, eq, gte, sql } from 'drizzle-orm';
import { metricEvents } from '@shoppingmate/db/schema';
import { db } from './db';
import { aggregateIntents, type IntentInsights, type IntentTagRow } from './intent-insights.js';

export async function getIntentInsights(args: { merchantId: string; days?: number }): Promise<IntentInsights> {
  const days = args.days ?? 30;
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({
      intent: sql<string | null>`${metricEvents.tags}->'intent'->>'intent'`,
      outcome: sql<string | null>`${metricEvents.tags}->>'outcome'`,
      needs: sql<string[]>`coalesce(${metricEvents.tags}->'intent'->'needs', '[]'::jsonb)`,
      objections: sql<string[]>`coalesce(${metricEvents.tags}->'intent'->'objections', '[]'::jsonb)`,
      dropStage: sql<string | null>`${metricEvents.tags}->'intent'->>'dropStage'`,
    })
    .from(metricEvents)
    .where(and(
      eq(metricEvents.merchantId, args.merchantId),
      eq(metricEvents.metricName, 'conversationCompleted'),
      gte(metricEvents.ts, since),
      sql`${metricEvents.tags} ? 'intent'`,
    ));
  return aggregateIntents(rows as IntentTagRow[]);
}
```
NOTE: `Date.now()` is fine in web repos (NOT in workflow scripts). The `tags ? 'intent'` operator filters to rows that have the intent key. Test: `vi.mock('./db')` returning the chained builder ending at `.where()` resolving raw rows (intent/outcome/needs/objections/dropStage); assert `getIntentInsights` returns aggregated insights. Mirror `kpi-repo.test.ts` mock shape (`.select().from().where()` — no orderBy/limit here).

---

### Task 3: `audience-repo.ts` + test

**Files:** Create `web/src/lib/audience-repo.ts` + `audience-repo.test.ts`.

```ts
import { desc, eq } from 'drizzle-orm';
import { visitorProfiles } from '@shoppingmate/db/schema';
import { db } from './db';

export type AudienceRow = {
  visitorId: string;
  name: string | null;
  city: string | null;
  topIntents: string[];
  needs: string[];
  sessionCount: number;
  lifetimeValueCents: number;
  lastOutcome: string | null;
  lastSeen: Date;
};

export async function listAudience(args: { merchantId: string; limit?: number }): Promise<AudienceRow[]> {
  const rows = await db
    .select()
    .from(visitorProfiles)
    .where(eq(visitorProfiles.merchantId, args.merchantId))
    .orderBy(desc(visitorProfiles.lastSeen))
    .limit(args.limit ?? 100);
  return rows.map((r) => {
    const id = (r.identity ?? {}) as { name?: string; city?: string };
    return {
      visitorId: r.visitorId,
      name: id.name ?? null,
      city: id.city ?? null,
      topIntents: (r.topIntents as string[]) ?? [],
      needs: (r.needs as string[]) ?? [],
      sessionCount: r.sessionCount,
      lifetimeValueCents: r.lifetimeValueCents,
      lastOutcome: r.lastOutcome,
      lastSeen: r.lastSeen,
    };
  });
}
```
Test: `vi.mock('./db')` chain `.select().from().where().orderBy().limit()` resolving 1 visitorProfiles row (with identity {name:'Karan',city:'Mumbai'}); assert mapped AudienceRow (name, topIntents, ltv).

---

### Task 4: extend `getConversation` with intent + render on detail page

**Files:** `web/src/lib/conversations-repo.ts` (extend `ConversationDetail` + `getConversation`), `web/src/app/app/conversations/[id]/page.tsx` (render).

- Add to `ConversationDetail` an optional `intent?: { intent: string; intentConfidence: number; needs: string[]; objections: string[]; identity: Record<string,unknown>; dropStage: string | null }`.
- In `getConversation`, read `t.intent` (the jsonb) and map it (guard arrays/objects), or leave `undefined` when absent.
- On the detail page, after the cost section, add a `Card` titled "Intent & signals" rendering (only when `convo.intent` present): primary intent + confidence, needs chips, objections chips, captured identity (name/city/email/phone) and dropStage. Match existing card styling. (Extend the conversations-repo test if one exists to cover intent mapping.)

---

### Task 5: pages + nav

**Files:** Create `web/src/app/app/intents/page.tsx`, `web/src/app/app/audience/page.tsx`; a reusable `web/src/components/dashboard/CountedBars.tsx`; edit `web/src/components/dashboard/Sidebar.tsx`.

- `CountedBars({title, rows}: {title: string; rows: Counted[]})` — Tailwind horizontal bars scaled to max count (mirror FunnelCard bar style); empty-state line when no rows.
- `/app/intents/page.tsx`: async server component — `getDashboardSession`, redirect if no merchant, `getIntentInsights({merchantId, days:30})`, render four `CountedBars` (Intent distribution, Top needs, Top objections, Drop-off stage) in `Card`s. Header "Customer intent · last 30 days".
- `/app/audience/page.tsx`: async server component — `listAudience({merchantId})`, render a table (mirror ConversationsTable): Visitor (name or short visitorId), City, Visits, Top intents, LTV (₹), Last outcome, Last seen. Empty-state when none.
- Sidebar `BASE_NAV`: add `{ href: '/app/intents', label: 'Intents' }` and `{ href: '/app/audience', label: 'Audience' }` after Conversations.

---

### Task 6: build, test, deploy, PROVE

- `cd web && pnpm build` (Next build) + `npx vitest run web/src/lib/intent-insights.test.ts web/src/lib/intent-repo.test.ts web/src/lib/audience-repo.test.ts` (+ any conversations-repo test) — all green; full web vitest green.
- Deploy: `vercel deploy --prod --yes` from repo root.
- PROVE with logs: the prod DB already has conversationCompleted rows with intent (from Phase 1/2 proofs, merchant SM-XPK2EN) + visitor_profiles rows. A proof script `web` repo call OR a direct query demonstrating `getIntentInsights`/`listAudience` return non-empty structured data for SM-XPK2EN. Optionally curl the deployed `/app/intents` (auth-gated, so a repo-level proof is acceptable): run `getIntentInsights`/`listAudience` against the prod DB and print the distribution + audience rows. Capture output as proof.
