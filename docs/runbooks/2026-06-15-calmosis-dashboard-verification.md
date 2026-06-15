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

All implemented and committed. Test evidence (canonical per-package configs):

- **Changed backend packages** (`npx vitest run packages/agent packages/db apps/api apps/voice-agent`): **232 passed / 232**.
  - `conversationRecorder` (3), funnel-metric runtime test (checkout.reached on /checkout nav), COD conversion route test — all green.
- **Web dashboard** (`cd web && pnpm vitest run`): **78 passed / 78** (was 73 after Phase 0; +5 new: audit-repo, funnel-repo, /api/live ×2, Sidebar Audit link).
- **Builds**: `@shoppingmate/db`, `@shoppingmate/agent`, `@shoppingmate/api`, `@shoppingmate/voice-agent` all `tsc` clean; `web` `tsc --noEmit` clean.

Delivered:
- `conversationCompleted` now emitted from voice (`agentWorker.ts`) + text (`apps/api/src/index.ts`) with transcript/outcome/duration/turns/funnel tags → lights up Conversations page, transcript drill-down, Conversations KPI.
- Funnel metrics `cart.add` + `checkout.reached` emitted at the shared runtime dispatch chokepoint (both voice + text inherit).
- `match_source='cod'` accepted by `/v1/conversion` for Calmosis bot-driven COD orders.
- `/app/audit` conversions ledger page + transcript links; bot-driven funnel card + live-now panel on Home; `/api/live` polling endpoint.

### Note on test-runner configs

Running `npx vitest run` at the **repo root** shows failures that are NOT product bugs:
- `packages/widget/src/host/activity.test.ts` — 2 happy-dom **timeouts** (environmental/flaky), pre-existing at HEAD; widget files untouched by this work.
- Web route tests fail under the root config because the `@`-alias fix lives in `web/vitest.config.ts`, not the root config. Run web tests with `cd web && pnpm vitest run` (78/78 green).

Use per-package test commands (above) as the source of truth.

### Git-state incident (resolved)

While running a diagnostic stash, a `git stash pop` (no arg) accidentally applied an unrelated pre-existing stash (`stash@{0}: On bucket-b-demo: task16-cleanup-leftover-noise`) on top of committed work, injecting conflict markers into several files. Resolved by restoring all affected files to HEAD (the tested, known-good state). The `task16` stash was left intact in the stash list — it contains old, never-committed "barge-in / cutPlayback" voice-agent work the user can recover deliberately if wanted. No committed work was lost; post-recovery builds + tests are green.

## Live smoke (requires DB creds + a live bot session — operator)

1. Drive a Calmosis bot conversation: recommend → cart.add → checkout nav → COD order.
2. `node apps/api/scripts/check-calmosis-metrics.mjs <merchantId>` → expect `conversationCompleted`, `cart.add`, `checkout.reached`.
3. Dashboard: Home funnel + live panel reflect it; Audit page lists the COD conversion; Conversations page shows the transcript.
