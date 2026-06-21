# Intent Capture — Phase 5: Brand-Level Auto-Learning (FINAL)

**Goal:** The bot learns to sell better for each brand as conversations accumulate: aggregate the brand's conversation records → distil a compact "selling playbook" → inject it into the system prompt → refine nightly.

**Architecture:** Two pure-ish brains in `@shoppingmate/agent` (`aggregateBrandStats` pure; `distilBrandPlaybook` one cheap LLM pass, grounded ONLY in stats, self-safe). A `brand_playbooks` table + repo in `@shoppingmate/db`. A nightly worker cron (mirrors the existing `site-graph-drift` cron) that, per merchant ≥ threshold conversations, queries `conversationCompleted` records → aggregate → distil → upsert. Injection at session start (by merchantId) into both prompts as a `WHAT'S WORKING FOR THIS BRAND` section — same mechanism Phase 2 used for `visitorSummary`.

**Guardrails (from spec §5b):** derived from REAL outcomes only (no invented tactics); regenerated (not appended) so it can't grow unbounded; gated by a minimum-conversation threshold (default 20; don't learn from a handful); never overrides brand facts (it's advisory "what's working" guidance, placed after brand truth).

**Tech stack:** cheap `chat()` (json/text, maxTokens ~500), drizzle/Postgres, BullMQ cron in `apps/worker`.

Verified terrain: cron pattern `apps/worker/src/index.ts:77-102` (Queue `repeat:{pattern:'0 3 * * *'}` + Worker iterating `db.query.merchants.findMany`); injection precedent = Phase 2 `visitorSummary` in `loadPromptOpts` (`apps/api/src/index.ts`) + `agentWorker.ts` resolveVoiceContext + `system.ts`/`voice-instructions.ts`. Records source = `metric_events` where `metric_name='conversationCompleted'`, `tags.intent` + `tags.outcome` + `tags.attributed_cents`.

---

### Task 1: `aggregateBrandStats` (pure) + `distilBrandPlaybook` (LLM) + tests

**Files:** Create `packages/agent/src/brand-playbook.ts` + `brand-playbook.test.ts`; export from `index.ts`.

```ts
import type { ChatFn } from './checkout-extract.js';

export type BrandRecord = {
  intent: string | null;
  needs: string[];
  objections: string[];
  outcome: string;           // 'purchased' | 'abandoned'
  couponUsed: boolean;
  attributedCents: number;
};
export type RateRow = { key: string; count: number; purchasedRate: number };
export type ObjectionRow = { key: string; count: number; overcomeRate: number };
export type BrandStats = {
  total: number;
  purchasedRate: number;
  byIntent: RateRow[];
  byNeed: RateRow[];
  objections: ObjectionRow[];
  dropStages: { key: string; count: number }[];
  couponPurchasedRate: number | null;   // purchase rate among coupon-used convos
  noCouponPurchasedRate: number | null;
};

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) / 100 : 0);

export function aggregateBrandStats(records: BrandRecord[], dropStages: string[] = []): BrandStats {
  const total = records.length;
  const purchased = records.filter((r) => r.outcome === 'purchased');
  const groupRate = (keyOf: (r: BrandRecord) => string[]): RateRow[] => {
    const all = new Map<string, number>();
    const won = new Map<string, number>();
    for (const r of records) for (const k of new Set(keyOf(r))) { if (!k) continue; all.set(k, (all.get(k) ?? 0) + 1); if (r.outcome === 'purchased') won.set(k, (won.get(k) ?? 0) + 1); }
    return [...all.entries()].map(([key, count]) => ({ key, count, purchasedRate: rate(won.get(key) ?? 0, count) })).sort((a, b) => b.count - a.count);
  };
  const couponUsed = records.filter((r) => r.couponUsed);
  const noCoupon = records.filter((r) => !r.couponUsed);
  const dropTally = new Map<string, number>();
  for (const s of dropStages) { const k = (s ?? '').trim(); if (k) dropTally.set(k, (dropTally.get(k) ?? 0) + 1); }
  return {
    total,
    purchasedRate: rate(purchased.length, total),
    byIntent: groupRate((r) => [r.intent ?? 'unknown']),
    byNeed: groupRate((r) => r.needs ?? []),
    objections: groupRate((r) => r.objections ?? []).map((o) => ({ key: o.key, count: o.count, overcomeRate: o.purchasedRate })),
    dropStages: [...dropTally.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    couponPurchasedRate: couponUsed.length ? rate(couponUsed.filter((r) => r.outcome === 'purchased').length, couponUsed.length) : null,
    noCouponPurchasedRate: noCoupon.length ? rate(noCoupon.filter((r) => r.outcome === 'purchased').length, noCoupon.length) : null,
  };
}

const PB_SYS = `You write a SHORT brand "selling playbook" for an AI shopping assistant, grounded ONLY in the supplied stats. 200-350 words MAX. Sections: LEAD WITH (top converting intents/needs — what to surface first), PRE-EMPT (most common objections + how to handle, note which were overcome), CONVERTS (offers/coupons/products that lift purchase), WHERE TO PUSH vs SLOW DOWN (drop stages). Use ONLY the numbers given — never invent products, claims, or tactics not supported by the stats. Plain imperative guidance the bot can follow. No preamble.`;

// Distil stats → playbook text. Self-safe: returns '' on any failure.
export async function distilBrandPlaybook(stats: BrandStats, chat: ChatFn): Promise<string> {
  try {
    const { text } = await chat([
      { role: 'system', content: PB_SYS },
      { role: 'user', content: `Stats (real outcomes):\n${JSON.stringify(stats, null, 2)}\n\nWrite the playbook now.` },
    ]);
    return (text ?? '').trim();
  } catch {
    return '';
  }
}
```
Tests: `aggregateBrandStats` — byIntent/byNeed purchasedRate, objection overcomeRate, couponPurchasedRate vs noCoupon, total/purchasedRate (build ~5 records). `distilBrandPlaybook` — mock chat returns text → returned trimmed; mock chat throws → ''. Run `npx vitest run packages/agent/src/brand-playbook.test.ts`.

---

### Task 2: `brand_playbooks` table + repo

**Files:** `packages/db/src/schema/brandPlaybooks.ts`, export in `schema/index.ts`, migration (`db:generate`), `packages/db/src/repos/brandPlaybookRepo.ts` + test, export from `packages/db/src/index.ts`.

Table `brand_playbooks`: `merchantId text primaryKey references merchants(id)`, `playbook text notNull`, `basedOnCount integer notNull default 0`, `generatedAt timestamptz notNull defaultNow()`. Repo: `loadBrandPlaybook(merchantId): Promise<{playbook: string; basedOnCount: number} | null>`; `upsertBrandPlaybook(merchantId, playbook, basedOnCount): Promise<void>` (onConflictDoUpdate on merchantId). Test the merge/mapping with a mocked db chain (mirror visitorProfileRepo style) OR a pure mapping if extracted.

---

### Task 3: inject playbook into both prompts + session start

**Files:** `packages/agent/src/prompts/system.ts`, `voice-instructions.ts`, `apps/api/src/index.ts` (`loadPromptOpts`), `apps/voice-agent/src/agentWorker.ts` (+ `persona.ts`).

- `SystemPromptOpts.brandPlaybook?: string`; build `playbookBlock = opts.brandPlaybook?.trim() ? \`\nWHAT'S WORKING FOR THIS BRAND (data-driven guidance — follow it, but NEVER contradict brand facts above):\n${opts.brandPlaybook.trim()}\n\` : ''`; inject in BOTH non-demo and demo prompts, placed AFTER the brand/KB truth (so it can't override facts) — e.g. right before the HOW TO ANSWER section (non-demo) and after BRAND CONTEXT (demo).
- `VoiceInstructionOpts.brandPlaybook?: string`; push a matching `WHAT'S WORKING FOR THIS BRAND` section after the brand summary/KB.
- TEXT: in `loadPromptOpts(merchantId, visitorId)` also `loadBrandPlaybook(merchantId)` (best-effort) → return `brandPlaybook` in opts. (Per-merchant; no per-turn cost concern but it's one indexed read — acceptable, or cache later.)
- VOICE: in `agentWorker.ts` before `resolveVoiceContext`, `const pb = await loadBrandPlaybook(merchant.id).catch(()=>null); ... brandPlaybook: pb?.playbook` threaded through `resolveVoiceContext` opts → `buildVoiceSystemInstruction`.
- Extend system.test.ts + voice-instructions.test.ts (+1 assertion each: brandPlaybook appears; absent when empty).

---

### Task 4: nightly refresh cron (the "auto" in auto-learning) + orchestration

**Files:** `apps/worker/src/cron/refreshPlaybooks.ts` + test; register in `apps/worker/src/index.ts`.

`runPlaybookRefresh({ merchantId, chat, minConversations = 20 })`:
1. Query `metric_events` (db) where merchant + `conversationCompleted` + `tags ? 'intent'` over the last 90 days → map each to `BrandRecord` (intent=`tags.intent.intent`, needs/objections from `tags.intent`, outcome=`tags.outcome`, couponUsed=`!!tags.intent.preferences.coupon`, attributedCents=`tags.attributed_cents`) and collect dropStages (`tags.intent.dropStage` for abandoned).
2. If `records.length < minConversations` → return `{ ok: false, reason: 'below_threshold', count }` (DON'T regenerate — guardrail).
3. `aggregateBrandStats(records, dropStages)` → `distilBrandPlaybook(stats, chat)`; if playbook is '' → return `{ ok:false, reason:'distil_empty' }`.
4. `upsertBrandPlaybook(merchantId, playbook, records.length)` → `{ ok: true, count, playbook }`.
Register a BullMQ Queue `brand-playbook-refresh` with `repeat: { pattern: '0 4 * * *' }` (4am UTC) + a Worker iterating `db.query.merchants.findMany()` calling `runPlaybookRefresh` with a `chat` built from `chat()` (OPENROUTER model), best-effort per merchant (log + continue on error). Test `refreshPlaybooks.test.ts`: mock db + chat, assert below-threshold skips and a sufficient set produces an upsert (mirror `driftDetect.test.ts` mock style).

---

### Task 5: build, deploy, PROVE

- Builds: agent, db, api, voice-agent, worker. Apply migration to prod (`db:migrate` with `DATABASE_PUBLIC_URL`).
- Deploy api + voice-agent + worker (Railway).
- PROVE headless: `apps/api/scripts/prove-auto-learning-prod.mjs` — (1) run the same orchestration (query SM-XPK2EN conversationCompleted records from prod → aggregateBrandStats → distilBrandPlaybook with real chat → upsertBrandPlaybook) using a DEMO threshold (e.g. 3) since the demo has ~8 records; PRINT the generated playbook (show it's grounded in the real stats — references the actual top intents/objections). (2) Confirm it's stored (loadBrandPlaybook). (3) Run a fresh text conversation and confirm the bot's behavior reflects the playbook (e.g., it leads with what converts / pre-empts the common objection), and/or grep the api log for the injected section. Output the playbook + a PASS line (playbook non-empty + stored + references real stats).
- Note: prod cron uses threshold 20; the proof lowers it to demonstrate end-to-end with available data. Spoken-nudge flag (Phase 4) stays off.
