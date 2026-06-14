# Calmosis Brand Dashboard — Verification Runbook

**Date:** 2026-06-15
**Scope:** Verify all Phase 2 brand-dashboard features, then verify the new Calmosis dashboard features (audit ledger, transcripts, funnel, live view).

## Phase 0 — Baseline verification (existing Phase 2 dashboard)

### Finding 1 — Test suite was failing (17 failures), now green (73/73)

Initial `cd web && pnpm vitest run`: **51 passed / 17 failed** (68 tests). Memory claimed 71/71 on 2026-05-05.

**Root cause (test harness, not product):** On this Windows path (`C:\Users\naidu\Downloads\Personal Agentic shopper`, spaces + mixed case), `vite-tsconfig-paths` and vitest's mock registry normalized the `@/*` alias to different absolute paths. A test's `vi.mock('@/lib/session', …)` registered under one path; the route module imported `@/lib/session` under another. Result: route handlers silently received the **real** (unmocked) modules — auth routes returned 401 in tests that mocked an authed session.

Proven with a diagnostic: `getDashboardSession` returned the mock when imported by the test, but the real function when called inside the route's `POST()` (returned 401 despite a mocked session).

**Fix:** Added an explicit `resolve.alias['@'] → ./src` (absolute via `fileURLToPath`) in `web/vitest.config.ts` so both sides resolve to one canonical module. Dropped failures 17 → 1.

### Finding 2 — proxy rewrite test asserted a header the code never set

`src/proxy.test.ts` "rewrites app subdomain to /app prefix" checked for `x-proxy-rewrite` (never set) or `location` (only on redirects). `NextResponse.rewrite` only sets Next's internal `x-middleware-rewrite`, not a stable contract.

**Fix:** proxy now sets an explicit `x-proxy-rewrite` marker header on the subdomain→/app rewrite response (observability + stable assertion).

### Result

`cd web && pnpm vitest run` → **73 passed / 73** (34 files). ✅

### Finding 3 — `conversationCompleted` had no writer (drives Phase 1)

`git grep conversationCompleted` showed only readers (`kpi-repo.ts`, `conversations-repo.ts`). Nothing emitted it, so the Conversations page, the "Conversations" KPI, and transcripts were silently empty. Fixed in Phase 1 (ConversationRecorder + emission from voice/text paths).

## Phase 1–5 — New feature verification

(Filled in as each phase lands; see plan `docs/superpowers/plans/2026-06-15-calmosis-brand-dashboard.md`.)

## Live smoke (requires DB creds + a live bot session)

1. Drive a Calmosis bot conversation: recommend → cart.add → checkout nav → COD order.
2. `node apps/api/scripts/check-calmosis-metrics.mjs <merchantId>` → expect `conversationCompleted`, `cart.add`, `checkout.reached`.
3. Dashboard: Home funnel + live panel reflect it; Audit page lists the COD conversion; Conversations page shows the transcript.
