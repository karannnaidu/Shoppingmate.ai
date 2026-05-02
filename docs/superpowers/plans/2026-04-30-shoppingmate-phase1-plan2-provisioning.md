# shoppingmate.ai Phase 1 — Plan 2: Provisioning + Merchant Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest production-grade slice that takes a real merchant from zero to "Safe-Browsing-cleared, platform-fingerprinted, status=live" — via a CLI provisioning tool, a public `POST /v1/install` HTTP endpoint, and a real `OnboardingJob` worker handler.

**Architecture:** Three independently testable units. (1) New `@shoppingmate/cli` package with `provision`/`retry-onboarding`/`show` subcommands. (2) New `apps/api` route `/v1/install` with origin/rate-limit/allowed-domain validation, idempotent state machine, and BullMQ enqueue. (3) Real `OnboardingJob` handler in `apps/worker` running SafetyCheck → fingerprint (Shopify/Woo/custom) → finalize.

**Tech Stack:** Same as Plan 1 (Node 20, TS 5.6, pnpm 10.6.2, Hono 4, Drizzle 0.36, drizzle-kit 0.31, BullMQ 5, ioredis 5, Vitest 2, Biome 1.9, Pino 9). Adds: `zod` (body validation), `msw` 2.x (test mocking).

**Spec:** [`docs/superpowers/specs/2026-04-30-shoppingmate-phase1-plan2-provisioning-design.md`](../specs/2026-04-30-shoppingmate-phase1-plan2-provisioning-design.md)

**Out of scope for this plan:** Catalog sync, platform adapters (Shopify Admin API / Woo REST etc.), vision-grounded selector extraction, dashboard, self-heal, override editor, signed install tokens, additional platforms beyond Shopify/Woo/custom.

**Acceptance:** All criteria from §10 of the spec pass:
1. `pnpm shoppingmate provision --domain=example.com --name="Test"` creates a `pending` merchant + prints install snippet.
2. `POST /v1/install` with matching `Origin` returns `200 {status:"onboarding"}` first call, `200 {status:"live"}` after worker completes.
3. Final merchant row: `status='live'`, `platform ∈ {shopify, woocommerce, custom}`, `safety_checked_at` set.
4. Non-matching `Origin` → `403 {error:"origin_mismatch"}` and `install_attempts` row with `outcome='rejected_origin'`.
5. 11 calls in 60s on same merchantId → 11th returns `429`.
6. Safety-flagged domain → `status='rejected'`, no fingerprint metrics emitted.
7. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` all green; CI green.

**Note on status terminology:** the existing `merchants.status` enum from Plan 1 uses `'live'` (not `'active'`). This plan uses `'live'` throughout to match the existing convention. Final state of a successfully-onboarded merchant is `status='live'`.

---

## File structure

```
packages/cli/                                NEW
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                             # bin entry, parseArgs dispatcher
    ├── snippet.ts                           # buildInstallSnippet()
    ├── domain.ts                            # validateDomain()
    └── commands/
        ├── provision.ts
        ├── retryOnboarding.ts
        └── show.ts

packages/db/src/schema/
├── merchants.ts                             MODIFIED (new columns; expand status; nullable adapter_type)
├── installAttempts.ts                       NEW
├── metricEvents.ts                          MODIFIED (extend metricNames registry)
└── index.ts                                 MODIFIED (export installAttempts)
packages/db/drizzle/
└── 0001_<auto-named>.sql                    NEW (generated)

apps/api/src/
├── index.ts                                 MODIFIED (mount install route)
├── routes/
│   └── install.ts                           NEW
└── lib/
    ├── originCheck.ts                       NEW (pure)
    ├── nextInstallAction.ts                 NEW (pure)
    └── rateLimiter.ts                       NEW (Redis sliding window)

apps/worker/src/
├── index.ts                                 MODIFIED (wire real handler)
├── handlers/
│   └── onboarding.ts                        NEW
└── steps/
    ├── safetyCheck.ts                       NEW
    ├── fingerprint.ts                       NEW
    └── fingerprintRules/
        ├── index.ts                         NEW (registry + detectPlatform)
        ├── shopify.ts                       NEW
        └── woocommerce.ts                   NEW

scripts/
└── smoke-safety.ts                          NEW

tests/
├── cli/
│   ├── snippet.test.ts                      NEW
│   └── domain.test.ts                       NEW
├── api/
│   ├── originCheck.test.ts                  NEW
│   ├── nextInstallAction.test.ts            NEW
│   ├── rateLimiter.test.ts                  NEW (integration: Redis)
│   └── install.test.ts                      NEW (integration: Postgres+Redis)
├── worker/
│   ├── fingerprintRules.test.ts             NEW
│   ├── safetyCheck.test.ts                  NEW (msw)
│   ├── fingerprint.test.ts                  NEW (msw)
│   └── onboarding.test.ts                   NEW (integration)
└── fixtures/
    ├── shopifyHomepage.html                 NEW
    ├── wooHomepage.html                     NEW
    └── customHomepage.html                  NEW

.env.example                                 MODIFIED (no new keys; GOOGLE_SAFE_BROWSING_API_KEY already exists from Plan 1)
README.md                                    MODIFIED (CLI usage + /v1/install)
package.json                                 MODIFIED (root: add `bin` mapping for `shoppingmate` and `shoppingmate:dev` script)
```

---

## Task 1: Schema migration — extend merchants, add install_attempts

**Files:**
- Modify: `packages/db/src/schema/merchants.ts`
- Create: `packages/db/src/schema/installAttempts.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0001_<auto>.sql` (generated by drizzle-kit)

- [ ] **Step 1: Modify `packages/db/src/schema/merchants.ts`**

Replace the file with:

```ts
import { jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const merchantStatus = [
  'pending',
  'onboarding',
  'live',
  'degraded',
  'suspended',
  'failed',
  'rejected',
] as const;
export type MerchantStatus = (typeof merchantStatus)[number];

export const adapterTypes = [
  'shopify',
  'woo',
  'magento',
  'bigcommerce',
  'wix',
  'squarespace',
  'dom',
  'suggest',
] as const;
export type AdapterType = (typeof adapterTypes)[number];

export const platformValues = ['shopify', 'woocommerce', 'custom'] as const;
export type PlatformValue = (typeof platformValues)[number];

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  name: text('name'),
  allowedDomains: text('allowed_domains').array().notNull().default([]),
  platform: text('platform').$type<PlatformValue>(),
  platformConfidence: numeric('platform_confidence'),
  status: text('status').$type<MerchantStatus>().notNull(),
  adapterType: text('adapter_type').$type<AdapterType>(),
  adapterConfig: jsonb('adapter_config').notNull().default({}),
  cartUrlTemplate: text('cart_url_template'),
  checkoutUrl: text('checkout_url'),
  couponFieldSelector: text('coupon_field_selector'),
  policyUrls: jsonb('policy_urls'),
  personaId: text('persona_id').default('concierge').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  lastInstallAt: timestamp('last_install_at', { withTimezone: true }),
  lastFingerprintedAt: timestamp('last_fingerprinted_at', { withTimezone: true }),
  safetyCheckedAt: timestamp('safety_checked_at', { withTimezone: true }),
  lastError: text('last_error'),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
```

Changes vs Plan 1: added `name`, `allowedDomains`, `lastInstallAt`, `lastFingerprintedAt`, `safetyCheckedAt`, `lastError`. Made `adapterType` nullable. Expanded `merchantStatus` with `'pending' | 'failed' | 'rejected'`. Added `platformValues` const for the narrowed `platform` type.

- [ ] **Step 2: Create `packages/db/src/schema/installAttempts.ts`**

```ts
import { bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const installOutcomes = [
  'enqueued',
  'noop',
  'rejected_origin',
  'rejected_domain',
  'rate_limited',
  'invalid_body',
  'merchant_not_found',
] as const;
export type InstallOutcome = (typeof installOutcomes)[number];

export const installAttempts = pgTable(
  'install_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: text('merchant_id').references(() => merchants.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    sourceIp: text('source_ip').notNull(),
    userAgent: text('user_agent').notNull(),
    referer: text('referer'),
    outcome: text('outcome').$type<InstallOutcome>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantCreatedIdx: index('install_attempts_merchant_created_idx').on(
      t.merchantId,
      t.createdAt.desc(),
    ),
    sourceIpCreatedIdx: index('install_attempts_source_ip_created_idx').on(
      t.sourceIp,
      t.createdAt.desc(),
    ),
  }),
);

export type InstallAttempt = typeof installAttempts.$inferSelect;
export type NewInstallAttempt = typeof installAttempts.$inferInsert;
```

Note: `merchantId` is nullable because `merchant_not_found` outcomes still need to be logged for forensics.

- [ ] **Step 3: Modify `packages/db/src/schema/index.ts`**

Add the line:

```ts
export * from './installAttempts.js';
```

Final file:

```ts
export * from './merchants.js';
export * from './products.js';
export * from './selectorCache.js';
export * from './conversionEvents.js';
export * from './billingLedger.js';
export * from './metricEvents.js';
export * from './installAttempts.js';
```

- [ ] **Step 4: Generate the migration**

Run from repo root:

```bash
pnpm db:generate
```

Expected: a new file `packages/db/drizzle/0001_<auto-named>.sql` appears containing ALTER TABLE statements for `merchants` and a CREATE TABLE for `install_attempts`. Drizzle may auto-generate a name like `0001_glamorous_sentry.sql` — that's fine.

- [ ] **Step 5: Apply the migration**

Run:

```bash
pnpm db:migrate
```

Expected: `migrations applied` printed. No errors. (Docker compose must be up; if not, run `docker compose up -d` first.)

- [ ] **Step 6: Verify schema in Postgres**

Run:

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "\d merchants" -c "\d install_attempts"
```

Expected: `merchants` table shows new columns; `install_attempts` table exists with the listed columns and two indexes.

- [ ] **Step 7: Lint and typecheck**

```bash
pnpm lint:fix && pnpm typecheck
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/merchants.ts packages/db/src/schema/installAttempts.ts packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat(db): extend merchants for provisioning lifecycle; add install_attempts"
```

---

## Task 2: Extend metricNames registry

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`

- [ ] **Step 1: Add new entries to `metricNames`**

In `packages/db/src/schema/metricEvents.ts`, replace the `metricNames` const with:

```ts
export const metricNames = {
  selectorFirstTrySuccess: 'selector.first_try.success',
  selectorFirstTryFail: 'selector.first_try.fail',
  selectorHealAttempted: 'selector.heal.attempted',
  selectorHealSucceeded: 'selector.heal.succeeded',
  selectorOverrideSkipped: 'selector.override.skipped',
  selectorOverrideAlerted: 'selector.override.alerted',
  toolCallDurationMs: 'tool.call.duration_ms',
  voiceNumericPriceCorrected: 'voice.numeric_price_corrected',
  installReceived: 'install.received',
  installRateLimited: 'install.rate_limited',
  installRejectedOrigin: 'install.rejected_origin',
  installRejectedDomain: 'install.rejected_domain',
  onboardingSafetyCleared: 'onboarding.safety.cleared',
  onboardingSafetyRejected: 'onboarding.safety.rejected',
  onboardingSafetyError: 'onboarding.safety.error',
  onboardingFingerprintShopify: 'onboarding.fingerprint.shopify',
  onboardingFingerprintWoocommerce: 'onboarding.fingerprint.woocommerce',
  onboardingFingerprintCustom: 'onboarding.fingerprint.custom',
  onboardingFingerprintFetchFailed: 'onboarding.fingerprint.fetch_failed',
  onboardingCompleted: 'onboarding.completed',
  onboardingFailed: 'onboarding.failed',
} as const;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/metricEvents.ts
git commit -m "feat(db): add metric name constants for install + onboarding events"
```

---

## Task 3: Bootstrap @shoppingmate/cli package

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts` (placeholder)
- Modify: `package.json` (root) — add bin + dev scripts
- Modify: `pnpm-workspace.yaml` — already includes `packages/*`, no change

- [ ] **Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "@shoppingmate/cli",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "shoppingmate": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx --env-file-if-exists=../../.env src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@shoppingmate/db": "workspace:*",
    "@shoppingmate/jobs": "workspace:*",
    "@shoppingmate/shared": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/cli/tsconfig.json`**

Match the pattern from `packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create placeholder `packages/cli/src/index.ts`**

```ts
#!/usr/bin/env node
console.log('shoppingmate CLI — implement me');
```

- [ ] **Step 4: Add root scripts to `package.json`**

In the repo root `package.json`, add to `scripts`:

```json
    "shoppingmate": "node packages/cli/dist/index.js",
    "shoppingmate:dev": "pnpm --filter @shoppingmate/cli dev"
```

After modification the `scripts` block should contain (existing entries unchanged, plus the two above).

- [ ] **Step 5: Install workspace links**

```bash
pnpm install
```

Expected: pnpm picks up the new package, links workspace deps. No errors.

- [ ] **Step 6: Verify scaffolding**

```bash
pnpm shoppingmate:dev
```

Expected: prints `shoppingmate CLI — implement me`.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/ package.json
git commit -m "feat(cli): scaffold @shoppingmate/cli package with bin entry"
```

---

## Task 4: CLI helpers — domain validator + install snippet builder

**Files:**
- Create: `packages/cli/src/domain.ts`
- Create: `packages/cli/src/snippet.ts`
- Create: `tests/cli/domain.test.ts`
- Create: `tests/cli/snippet.test.ts`

- [ ] **Step 1: Write failing test for `validateDomain`**

Create `tests/cli/domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateDomain } from '../../packages/cli/src/domain.js';

describe('validateDomain', () => {
  it('accepts a bare hostname', () => {
    expect(validateDomain('acmesoap.com')).toBe('acmesoap.com');
  });

  it('lowercases the hostname', () => {
    expect(validateDomain('AcmeSoap.COM')).toBe('acmesoap.com');
  });

  it('strips a leading https:// scheme', () => {
    expect(validateDomain('https://acmesoap.com')).toBe('acmesoap.com');
  });

  it('strips a trailing slash', () => {
    expect(validateDomain('acmesoap.com/')).toBe('acmesoap.com');
  });

  it('rejects a hostname with a path', () => {
    expect(() => validateDomain('acmesoap.com/products')).toThrow(/path/);
  });

  it('rejects an empty string', () => {
    expect(() => validateDomain('')).toThrow();
  });

  it('rejects whitespace-only input', () => {
    expect(() => validateDomain('   ')).toThrow();
  });

  it('rejects a value without a dot', () => {
    expect(() => validateDomain('acmesoap')).toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test tests/cli/domain.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `validateDomain`**

Create `packages/cli/src/domain.ts`:

```ts
export function validateDomain(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('domain is required');

  let value = trimmed.toLowerCase();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      throw new Error(`invalid domain: ${input}`);
    }
  }
  value = value.replace(/\/$/, '');

  if (value.includes('/')) {
    throw new Error(`domain must not contain a path: ${input}`);
  }
  if (!value.includes('.')) {
    throw new Error(`domain must contain a dot: ${input}`);
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    throw new Error(`domain contains invalid characters: ${input}`);
  }
  return value;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test tests/cli/domain.test.ts
```

Expected: PASS (8/8).

- [ ] **Step 5: Write failing test for `buildInstallSnippet`**

Create `tests/cli/snippet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildInstallSnippet } from '../../packages/cli/src/snippet.js';

describe('buildInstallSnippet', () => {
  it('emits a script tag with the merchantId in data-merchant', () => {
    const out = buildInstallSnippet('SM-A7K2X9');
    expect(out).toContain('data-merchant="SM-A7K2X9"');
    expect(out).toContain('<script');
    expect(out).toContain('async');
  });

  it('points at the production cdn host', () => {
    const out = buildInstallSnippet('SM-XXXXXX');
    expect(out).toMatch(/src="https:\/\/cdn\.shoppingmate\.ai\/gtag\.js"/);
  });

  it('throws on a malformed merchantId', () => {
    expect(() => buildInstallSnippet('not-a-merchant')).toThrow();
    expect(() => buildInstallSnippet('SM-')).toThrow();
    expect(() => buildInstallSnippet('SM-ABC')).toThrow();
  });
});
```

- [ ] **Step 6: Run test, expect failure**

```bash
pnpm test tests/cli/snippet.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement `buildInstallSnippet`**

Create `packages/cli/src/snippet.ts`:

```ts
const MERCHANT_ID_RE = /^SM-[A-Z0-9]{6}$/;

export function buildInstallSnippet(merchantId: string): string {
  if (!MERCHANT_ID_RE.test(merchantId)) {
    throw new Error(`invalid merchantId: ${merchantId}`);
  }
  return `<script src="https://cdn.shoppingmate.ai/gtag.js" data-merchant="${merchantId}" async></script>`;
}
```

Note: the merchantId regex follows the alphabet from `packages/shared/src/ids.ts` — `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` is a subset of `[A-Z0-9]`, so this regex accepts all generated IDs and rejects garbage.

- [ ] **Step 8: Run test, expect pass**

```bash
pnpm test tests/cli/snippet.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 9: Lint and typecheck**

```bash
pnpm lint:fix && pnpm typecheck
```

Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add packages/cli/src/domain.ts packages/cli/src/snippet.ts tests/cli/
git commit -m "feat(cli): add domain validator and install snippet builder"
```

---

## Task 5: CLI provision command

**Files:**
- Create: `packages/cli/src/commands/provision.ts`

- [ ] **Step 1: Implement provision command**

Create `packages/cli/src/commands/provision.ts`:

```ts
import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { validateDomain } from '../domain.js';
import { buildInstallSnippet } from '../snippet.js';

export type ProvisionArgs = {
  domain: string;
  name?: string;
  allow?: string[];
};

export async function provision(args: ProvisionArgs): Promise<void> {
  const primary = validateDomain(args.domain);
  const extras = (args.allow ?? []).map(validateDomain);
  const allowedDomains = Array.from(new Set([primary, ...extras]));

  const id = generateMerchantId();

  await db.insert(schema.merchants).values({
    id,
    domain: primary,
    name: args.name ?? null,
    allowedDomains,
    status: 'pending',
  });

  const snippet = buildInstallSnippet(id);
  console.log(`Created merchant ${id} for ${primary}`);
  if (args.name) console.log(`  name: ${args.name}`);
  if (allowedDomains.length > 1) console.log(`  allowed_domains: ${allowedDomains.join(', ')}`);
  console.log('\nInstall snippet (paste into <head> of the brand site):\n');
  console.log(snippet);
}
```

- [ ] **Step 2: Manual smoke**

After Tasks 6–8 wire the dispatcher, this gets exercised end-to-end. For now, just verify it compiles:

```bash
pnpm --filter @shoppingmate/cli typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/provision.ts
git commit -m "feat(cli): add provision command"
```

---

## Task 6: CLI retry-onboarding command

**Files:**
- Create: `packages/cli/src/commands/retryOnboarding.ts`

- [ ] **Step 1: Implement retry-onboarding command**

Create `packages/cli/src/commands/retryOnboarding.ts`:

```ts
import { db, schema } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';
import { eq } from 'drizzle-orm';

export async function retryOnboarding(merchantId: string): Promise<void> {
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    console.error(`merchant not found: ${merchantId}`);
    process.exitCode = 1;
    return;
  }

  if (merchant.status === 'rejected') {
    console.error(
      `merchant ${merchantId} is rejected (Safe Browsing flag); will not retry. Investigate before forcing.`,
    );
    process.exitCode = 1;
    return;
  }

  await db
    .update(schema.merchants)
    .set({ status: 'onboarding', lastError: null, lastInstallAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));

  await onboardingQueue.add('onboarding', { merchantId, domain: merchant.domain });
  console.log(`re-enqueued onboarding for ${merchantId} (${merchant.domain})`);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @shoppingmate/cli typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/retryOnboarding.ts
git commit -m "feat(cli): add retry-onboarding command"
```

---

## Task 7: CLI show command

**Files:**
- Create: `packages/cli/src/commands/show.ts`

- [ ] **Step 1: Implement show command**

Create `packages/cli/src/commands/show.ts`:

```ts
import { db, schema } from '@shoppingmate/db';
import { desc, eq } from 'drizzle-orm';

export async function show(merchantId: string): Promise<void> {
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    console.error(`merchant not found: ${merchantId}`);
    process.exitCode = 1;
    return;
  }

  const attempts = await db
    .select()
    .from(schema.installAttempts)
    .where(eq(schema.installAttempts.merchantId, merchantId))
    .orderBy(desc(schema.installAttempts.createdAt))
    .limit(5);

  console.log(JSON.stringify(merchant, null, 2));
  console.log('\nLast 5 install attempts:');
  if (attempts.length === 0) {
    console.log('  (none)');
  } else {
    for (const a of attempts) {
      console.log(
        `  ${a.createdAt.toISOString()}  ${a.outcome.padEnd(20)}  ip=${a.sourceIp}  domain=${a.domain}`,
      );
    }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @shoppingmate/cli typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/show.ts
git commit -m "feat(cli): add show command"
```

---

## Task 8: Wire CLI dispatcher

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Replace `packages/cli/src/index.ts` with the dispatcher**

```ts
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { provision } from './commands/provision.js';
import { retryOnboarding } from './commands/retryOnboarding.js';
import { show } from './commands/show.js';

const USAGE = `Usage:
  shoppingmate provision --domain=<host> [--name=<text>] [--allow=<host>,...]
  shoppingmate retry-onboarding <merchantId>
  shoppingmate show <merchantId>
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(USAGE);
    return;
  }

  switch (subcommand) {
    case 'provision': {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          domain: { type: 'string' },
          name: { type: 'string' },
          allow: { type: 'string' },
        },
        strict: true,
      });
      if (!values.domain) {
        console.error('--domain is required');
        process.exitCode = 1;
        return;
      }
      await provision({
        domain: values.domain,
        name: values.name,
        allow: values.allow ? values.allow.split(',') : undefined,
      });
      return;
    }
    case 'retry-onboarding': {
      const id = argv[1];
      if (!id) {
        console.error('merchantId argument is required');
        process.exitCode = 1;
        return;
      }
      await retryOnboarding(id);
      return;
    }
    case 'show': {
      const id = argv[1];
      if (!id) {
        console.error('merchantId argument is required');
        process.exitCode = 1;
        return;
      }
      await show(id);
      return;
    }
    default:
      console.error(`unknown subcommand: ${subcommand}\n${USAGE}`);
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Force exit so postgres + ioredis client pools don't hold the event loop open
    setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
  });
```

- [x] **Step 2: End-to-end smoke — provision a real merchant**

> Verified 2026-05-02 against `growth-os-two-jet.vercel.app`. Created `SM-JSQ2W4`, row written with `status=pending`, `persona_id=concierge`, `allowed_domains={growth-os-two-jet.vercel.app}`, `installed_at=2026-05-02 16:57:09Z`.

```bash
pnpm --filter @shoppingmate/db db:migrate
pnpm shoppingmate:dev provision --domain=example.com --name="Example Co"
```

Expected output:
```
Created merchant SM-XXXXXX for example.com
  name: Example Co

Install snippet (paste into <head> of the brand site):

<script src="https://cdn.shoppingmate.ai/gtag.js" data-merchant="SM-XXXXXX" async></script>
```

Verify the row exists:

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "SELECT id, domain, name, allowed_domains, status FROM merchants WHERE domain='example.com';"
```

Expected: one row, `status=pending`.

- [ ] **Step 3: Smoke `show`**

Take the printed merchant ID from Step 2 and run:

```bash
pnpm shoppingmate:dev show SM-XXXXXX
```

Expected: full merchant JSON, then `Last 5 install attempts: (none)`.

- [ ] **Step 4: Clean up smoke data**

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "DELETE FROM merchants WHERE domain='example.com';"
```

- [ ] **Step 5: Lint, typecheck, build**

```bash
pnpm lint:fix && pnpm typecheck && pnpm --filter @shoppingmate/cli build
```

Expected: clean. `packages/cli/dist/index.js` produced.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): wire subcommand dispatcher with provision/retry/show"
```

---

## Task 9: API helper — originCheck

**Files:**
- Create: `apps/api/src/lib/originCheck.ts`
- Create: `tests/api/originCheck.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/originCheck.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { originMatches } from '../../apps/api/src/lib/originCheck.js';

describe('originMatches', () => {
  it('accepts when Origin host equals expected domain', () => {
    expect(originMatches('https://acmesoap.com', undefined, 'acmesoap.com')).toBe(true);
  });

  it('falls back to Referer when Origin is missing', () => {
    expect(originMatches(undefined, 'https://acmesoap.com/products/shampoo', 'acmesoap.com')).toBe(
      true,
    );
  });

  it('rejects when both headers are missing', () => {
    expect(originMatches(undefined, undefined, 'acmesoap.com')).toBe(false);
  });

  it('rejects when host does not match', () => {
    expect(originMatches('https://evil.com', undefined, 'acmesoap.com')).toBe(false);
  });

  it('does not auto-accept www variants', () => {
    expect(originMatches('https://www.acmesoap.com', undefined, 'acmesoap.com')).toBe(false);
  });

  it('rejects malformed Origin values', () => {
    expect(originMatches('not-a-url', undefined, 'acmesoap.com')).toBe(false);
  });

  it('handles non-default ports by ignoring them', () => {
    expect(originMatches('http://localhost:5173', undefined, 'localhost')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test tests/api/originCheck.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/originCheck.ts`:

```ts
export function originMatches(
  origin: string | undefined,
  referer: string | undefined,
  expectedDomain: string,
): boolean {
  const host = extractHost(origin) ?? extractHost(referer);
  return host !== null && host === expectedDomain;
}

function extractHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
```

Rationale: www variants and aliases must be enrolled explicitly via `allowed_domains` at provision time — keeps the host check strict and the surface explicit.

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test tests/api/originCheck.test.ts
```

Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/originCheck.ts tests/api/originCheck.test.ts
git commit -m "feat(api): add originMatches helper for /v1/install header validation"
```

---

## Task 10: API helper — nextInstallAction state machine

**Files:**
- Create: `apps/api/src/lib/nextInstallAction.ts`
- Create: `tests/api/nextInstallAction.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/nextInstallAction.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextInstallAction } from '../../apps/api/src/lib/nextInstallAction.js';

const NOW = new Date('2026-04-30T12:00:00Z');
const ONE_HOUR = 60 * 60 * 1000;

describe('nextInstallAction', () => {
  it('enqueues when status=pending', () => {
    expect(nextInstallAction({ status: 'pending', lastInstallAt: null }, NOW)).toEqual({
      kind: 'enqueue',
    });
  });

  it('enqueues when status=failed', () => {
    expect(
      nextInstallAction(
        { status: 'failed', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'enqueue' });
  });

  it('noops when status=onboarding and last install <24h ago', () => {
    expect(
      nextInstallAction(
        { status: 'onboarding', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'noop' });
  });

  it('noops when status=onboarding and lastInstallAt is null (just transitioned)', () => {
    expect(nextInstallAction({ status: 'onboarding', lastInstallAt: null }, NOW)).toEqual({
      kind: 'noop',
    });
  });

  it('re-enqueues when status=onboarding and last install >24h ago', () => {
    expect(
      nextInstallAction(
        { status: 'onboarding', lastInstallAt: new Date(NOW.getTime() - 25 * ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'enqueue' });
  });

  it('noops when status=live', () => {
    expect(
      nextInstallAction({ status: 'live', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) }, NOW),
    ).toEqual({ kind: 'noop' });
  });

  it('noops when status=rejected (terminal)', () => {
    expect(
      nextInstallAction(
        { status: 'rejected', lastInstallAt: new Date(NOW.getTime() - ONE_HOUR) },
        NOW,
      ),
    ).toEqual({ kind: 'noop' });
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test tests/api/nextInstallAction.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/nextInstallAction.ts`:

```ts
import type { MerchantStatus } from '@shoppingmate/db/schema';

const STALE_ONBOARDING_MS = 24 * 60 * 60 * 1000;

export type InstallAction = { kind: 'enqueue' } | { kind: 'noop' };

export function nextInstallAction(
  merchant: { status: MerchantStatus; lastInstallAt: Date | null },
  now: Date,
): InstallAction {
  switch (merchant.status) {
    case 'pending':
    case 'failed':
      return { kind: 'enqueue' };
    case 'onboarding': {
      if (
        merchant.lastInstallAt &&
        now.getTime() - merchant.lastInstallAt.getTime() > STALE_ONBOARDING_MS
      ) {
        return { kind: 'enqueue' };
      }
      return { kind: 'noop' };
    }
    default:
      return { kind: 'noop' };
  }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test tests/api/nextInstallAction.test.ts
```

Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/nextInstallAction.ts tests/api/nextInstallAction.test.ts
git commit -m "feat(api): add install state-machine helper"
```

---

## Task 11: API helper — Redis sliding-window rate limiter

**Files:**
- Create: `apps/api/src/lib/rateLimiter.ts`
- Create: `tests/api/rateLimiter.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/rateLimiter.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { env } from '@shoppingmate/shared';
import { isAllowed } from '../../apps/api/src/lib/rateLimiter.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

describe('isAllowed', () => {
  beforeEach(async () => {
    await redis.del('test:rl:k1');
  });

  afterAll(async () => {
    await redis.del('test:rl:k1');
    await redis.quit();
  });

  it('allows up to limit within window', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const ok = await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + i);
      expect(ok).toBe(true);
    }
  });

  it('denies once limit reached in window', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + i);
    const denied = await isAllowed(redis, 'test:rl:k1', 5, 60_000, now + 5);
    expect(denied).toBe(false);
  });

  it('allows again after window slides past old entries', async () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + i);
    expect(await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + 5)).toBe(false);
    // 1.5s later (>1s window) the old entries are aged out
    expect(await isAllowed(redis, 'test:rl:k1', 5, 1_000, t0 + 1_500)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test tests/api/rateLimiter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/rateLimiter.ts`:

```ts
import type { Redis } from 'ioredis';

export async function isAllowed(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number,
): Promise<boolean> {
  const cutoff = nowMs - windowMs;
  const member = `${nowMs}-${Math.random()}`;

  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, cutoff);
  pipeline.zcard(key);
  const results = await pipeline.exec();

  if (!results) throw new Error('rate limiter pipeline failed');
  const count = results[1]?.[1] as number;

  if (count >= limit) return false;

  const writePipeline = redis.multi();
  writePipeline.zadd(key, nowMs, member);
  writePipeline.expire(key, Math.ceil(windowMs / 1000));
  await writePipeline.exec();
  return true;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test tests/api/rateLimiter.test.ts
```

Expected: PASS (3/3). (Requires Redis running via `docker compose up -d`.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/rateLimiter.ts tests/api/rateLimiter.test.ts
git commit -m "feat(api): add redis sliding-window rate limiter"
```

---

## Task 12: Install route — body schema, validation chain, state machine, enqueue

**Files:**
- Modify: `apps/api/package.json` — add `zod` dep
- Create: `apps/api/src/routes/install.ts`
- Modify: `apps/api/src/index.ts` — mount route + share Redis client

- [ ] **Step 1: Add zod dependency**

```bash
pnpm --filter @shoppingmate/api add zod@^3.23.8
```

Expected: zod installed.

- [ ] **Step 2: Create `apps/api/src/routes/install.ts`**

```ts
import { db, schema } from '@shoppingmate/db';
import { createRedisConnection, onboardingQueue } from '@shoppingmate/jobs';
import { childLogger } from '@shoppingmate/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { nextInstallAction } from '../lib/nextInstallAction.js';
import { originMatches } from '../lib/originCheck.js';
import { isAllowed } from '../lib/rateLimiter.js';

const log = childLogger({ route: 'install' });
const redis = createRedisConnection();

const InstallBody = z.object({
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
  domain: z.string().min(1),
  userAgent: z.string().min(1),
  referrer: z.string().optional().nullable(),
});

type Outcome = (typeof schema.installOutcomes)[number];

async function recordAttempt(
  c: { req: { header: (n: string) => string | undefined } },
  body: { merchantId: string | null; domain: string; userAgent: string; referrer?: string | null },
  sourceIp: string,
  outcome: Outcome,
): Promise<void> {
  await db.insert(schema.installAttempts).values({
    merchantId: body.merchantId,
    domain: body.domain,
    sourceIp,
    userAgent: body.userAgent,
    referer: body.referrer ?? null,
    outcome,
  });
}

function clientIp(c: { req: { header: (n: string) => string | undefined } }, fallback: string): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? fallback;
}

export const installRoute = new Hono();

installRoute.post('/', async (c) => {
  const sourceIp = clientIp(c, c.req.header('x-real-ip') ?? '0.0.0.0');
  const userAgentHeader = c.req.header('user-agent') ?? '';
  const refererHeader = c.req.header('referer') ?? null;

  // 1. Body validation
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = null;
  }
  const parsed = InstallBody.safeParse(raw);
  if (!parsed.success) {
    await recordAttempt(
      c,
      { merchantId: null, domain: 'unknown', userAgent: userAgentHeader, referrer: refererHeader },
      sourceIp,
      'invalid_body',
    );
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const body = parsed.data;

  // 2. Origin / Referer check
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  if (!originMatches(origin, referer, body.domain)) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rejected_origin');
    log.info({ merchantId: body.merchantId, origin, referer }, 'rejected_origin');
    return c.json({ error: 'origin_mismatch', message: 'origin/referer must match domain' }, 403);
  }

  // 3. Rate limits — per merchantId and per IP
  const now = Date.now();
  const merchantOk = await isAllowed(redis, `rl:merchant:${body.merchantId}`, 10, 60_000, now);
  const ipOk = await isAllowed(redis, `rl:ip:${sourceIp}`, 100, 60_000, now);
  if (!merchantOk || !ipOk) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rate_limited');
    log.warn({ merchantId: body.merchantId, sourceIp, merchantOk, ipOk }, 'rate_limited');
    return c.json({ error: 'rate_limited', message: 'too many requests' }, 429);
  }

  // 4. Lookup merchant
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  if (!merchant) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'merchant_not_found');
    return c.json({ error: 'merchant_not_found', message: 'unknown merchantId' }, 404);
  }

  // 5. allowed_domains check
  if (!merchant.allowedDomains.includes(body.domain)) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rejected_domain');
    log.warn({ merchantId: body.merchantId, domain: body.domain }, 'rejected_domain');
    return c.json({ error: 'domain_not_allowed', message: 'domain not in allowlist' }, 403);
  }

  // 6. State transition
  const action = nextInstallAction(
    { status: merchant.status, lastInstallAt: merchant.lastInstallAt },
    new Date(now),
  );

  if (action.kind === 'enqueue') {
    // Conditional update — only the row where status hasn't changed since we read it
    const updated = await db
      .update(schema.merchants)
      .set({
        status: 'onboarding',
        lastError: null,
        lastInstallAt: new Date(now),
      })
      .where(
        sql`${schema.merchants.id} = ${body.merchantId} AND ${schema.merchants.status} = ${merchant.status}`,
      )
      .returning({ id: schema.merchants.id });

    if (updated.length === 1) {
      await onboardingQueue.add('onboarding', {
        merchantId: body.merchantId,
        domain: body.domain,
      });
      await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'enqueued');
      log.info({ merchantId: body.merchantId }, 'enqueued onboarding');
    } else {
      // Lost the race; treat as noop
      await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'noop');
    }
  } else {
    // Still bump lastInstallAt for telemetry / staleness math
    await db
      .update(schema.merchants)
      .set({ lastInstallAt: new Date(now) })
      .where(eq(schema.merchants.id, body.merchantId));
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'noop');
  }

  // 7. Re-read for response (state may have advanced)
  const [fresh] = await db
    .select({ status: schema.merchants.status })
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  return c.json({ status: fresh?.status ?? merchant.status }, 200);
});
```

- [ ] **Step 3: Mount the route in `apps/api/src/index.ts`**

Replace the file with:

```ts
import { serve } from '@hono/node-server';
import { env, logger } from '@shoppingmate/shared';
import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { installRoute } from './routes/install.js';

const app = new Hono();
app.route('/health', healthRoute);
app.route('/v1/install', installRoute);

serve({ fetch: app.fetch, port: env.API_PORT }, ({ port }) => {
  logger.info({ port }, 'api listening');
});
```

- [ ] **Step 4: Lint, typecheck, build**

```bash
pnpm lint:fix && pnpm typecheck && pnpm --filter @shoppingmate/api build
```

Expected: clean.

- [ ] **Step 5: Smoke — boot api and curl /v1/install**

In one terminal:

```bash
pnpm --filter @shoppingmate/api dev
```

In another terminal, provision a test merchant and exercise the endpoint:

```bash
pnpm shoppingmate:dev provision --domain=smoke.test --name="Smoke"
# Note the SM-XXXXXX

curl -i -X POST http://127.0.0.1:3000/v1/install \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://smoke.test' \
  -d '{"merchantId":"SM-XXXXXX","domain":"smoke.test","userAgent":"smoke","referrer":null}'
```

Expected: `HTTP/1.1 200 OK` with body `{"status":"onboarding"}`. (The worker is still the Plan 1 stub — it will log "stub" and not advance state. That's fixed in Task 19.)

```bash
curl -i -X POST http://127.0.0.1:3000/v1/install \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://evil.com' \
  -d '{"merchantId":"SM-XXXXXX","domain":"smoke.test","userAgent":"smoke","referrer":null}'
```

Expected: `HTTP/1.1 403` with body `{"error":"origin_mismatch","message":"origin/referer must match domain"}`.

Clean up: kill api dev, delete merchant + attempts:

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "DELETE FROM merchants WHERE domain='smoke.test';"
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/routes/install.ts apps/api/src/index.ts
git commit -m "feat(api): add POST /v1/install with origin/rate-limit/state-machine"
```

---

## Task 13: Integration test — /v1/install full validation chain

**Files:**
- Create: `tests/api/install.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/api/install.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, schema } from '@shoppingmate/db';
import { createRedisConnection, onboardingQueue } from '@shoppingmate/jobs';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { installRoute } from '../../apps/api/src/routes/install.js';

const app = new Hono();
app.route('/v1/install', installRoute);

const redis = createRedisConnection();

async function cleanupMerchant(domain: string): Promise<void> {
  await db.delete(schema.merchants).where(eq(schema.merchants.domain, domain));
}

async function flushRateLimits(merchantId: string, ip: string): Promise<void> {
  await redis.del(`rl:merchant:${merchantId}`, `rl:ip:${ip}`);
}

async function provision(domain: string, allowedDomains?: string[]): Promise<string> {
  const id = generateMerchantId();
  await db.insert(schema.merchants).values({
    id,
    domain,
    allowedDomains: allowedDomains ?? [domain],
    status: 'pending',
  });
  return id;
}

function call(body: object, headers: Record<string, string> = {}): Promise<Response> {
  return app.request('/v1/install', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await db.delete(schema.installAttempts);
});

afterAll(async () => {
  await onboardingQueue.close();
  await redis.quit();
});

describe('POST /v1/install', () => {
  it('happy path: pending → enqueued → status=onboarding', async () => {
    const domain = 'happy.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');
    const before = await onboardingQueue.getJobCounts('waiting', 'active');

    const res = await call(
      { merchantId, domain, userAgent: 'test', referrer: null },
      { origin: `https://${domain}` },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('onboarding');

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId));
    expect(m?.status).toBe('onboarding');
    expect(m?.lastInstallAt).toBeInstanceOf(Date);

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.outcome).toBe('enqueued');

    const after = await onboardingQueue.getJobCounts('waiting', 'active');
    expect((after.waiting ?? 0) + (after.active ?? 0)).toBeGreaterThan(
      (before.waiting ?? 0) + (before.active ?? 0),
    );

    await cleanupMerchant(domain);
  });

  it('idempotency: repeat calls on live merchant noop', async () => {
    const domain = 'idem.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await db
      .update(schema.merchants)
      .set({ status: 'live', platform: 'shopify', lastFingerprintedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    await flushRateLimits(merchantId, '127.0.0.1');

    for (let i = 0; i < 3; i++) {
      const res = await call(
        { merchantId, domain, userAgent: 'test' },
        { origin: `https://${domain}` },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json.status).toBe('live');
    }

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.outcome === 'noop')).toBe(true);

    await cleanupMerchant(domain);
  });

  it('rejects mismatched Origin with 403 + rejected_origin row', async () => {
    const domain = 'mismatch.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');

    const res = await call(
      { merchantId, domain, userAgent: 'test' },
      { origin: 'https://evil.com' },
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('origin_mismatch');

    const attempts = await db
      .select()
      .from(schema.installAttempts)
      .where(eq(schema.installAttempts.merchantId, merchantId));
    expect(attempts[0]?.outcome).toBe('rejected_origin');

    await cleanupMerchant(domain);
  });

  it('rejects domain not in allowed_domains', async () => {
    const domain = 'allowlist.test';
    const otherDomain = 'other.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain, [domain]); // does NOT include otherDomain
    await flushRateLimits(merchantId, '127.0.0.1');

    const res = await call(
      { merchantId, domain: otherDomain, userAgent: 'test' },
      { origin: `https://${otherDomain}` },
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('domain_not_allowed');

    await cleanupMerchant(domain);
  });

  it('rate-limits at 11th call within window', async () => {
    const domain = 'ratelimit.test';
    await cleanupMerchant(domain);
    const merchantId = await provision(domain);
    await flushRateLimits(merchantId, '127.0.0.1');

    // 10 successful (mostly noop after first since status flips to onboarding)
    for (let i = 0; i < 10; i++) {
      const res = await call(
        { merchantId, domain, userAgent: 'test' },
        { origin: `https://${domain}` },
      );
      expect(res.status).toBe(200);
    }
    const res = await call(
      { merchantId, domain, userAgent: 'test' },
      { origin: `https://${domain}` },
    );
    expect(res.status).toBe(429);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('rate_limited');

    await cleanupMerchant(domain);
  });

  it('returns 404 for unknown merchantId', async () => {
    const fake = 'SM-ZZZZZZ';
    await flushRateLimits(fake, '127.0.0.1');
    const res = await call(
      { merchantId: fake, domain: 'unknown.test', userAgent: 'test' },
      { origin: 'https://unknown.test' },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 on malformed body', async () => {
    const res = await call(
      { not: 'a valid body' },
      { origin: 'https://x.test' },
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, expect pass**

```bash
pnpm test tests/api/install.test.ts
```

Expected: PASS (7/7). Requires Postgres + Redis running.

- [ ] **Step 3: Commit**

```bash
git add tests/api/install.test.ts
git commit -m "test(api): integration tests for /v1/install validation + state machine"
```

---

## Task 14: Fingerprint rule — Shopify

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/index.ts`
- Create: `apps/worker/src/steps/fingerprintRules/shopify.ts`
- Create: `tests/fixtures/shopifyHomepage.html`
- Create: `tests/fixtures/customHomepage.html`
- Create: `tests/worker/fingerprintRules.test.ts`

- [ ] **Step 1: Write fixtures**

Create `tests/fixtures/shopifyHomepage.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="Shopify" />
    <link rel="stylesheet" href="https://cdn.shopify.com/s/files/1/0001/0002/t/1/assets/theme.css" />
    <script>window.Shopify = window.Shopify || {}; window.Shopify.shop = "acme.myshopify.com";</script>
  </head>
  <body><h1>Acme</h1></body>
</html>
```

Create `tests/fixtures/customHomepage.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="Webflow" />
    <link rel="stylesheet" href="/static/style.css" />
  </head>
  <body><h1>Custom Brand</h1></body>
</html>
```

- [ ] **Step 2: Write failing test**

Create `tests/worker/fingerprintRules.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../apps/worker/src/steps/fingerprintRules/index.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

describe('detectPlatform', () => {
  it('detects Shopify by Shopify.shop variable', () => {
    expect(detectPlatform(shopifyHtml, {})).toBe('shopify');
  });

  it('detects Shopify by cdn.shopify.com asset', () => {
    const html = '<html><head><link rel="stylesheet" href="https://cdn.shopify.com/x.css"/></head></html>';
    expect(detectPlatform(html, {})).toBe('shopify');
  });

  it('falls back to custom when nothing matches', () => {
    expect(detectPlatform(customHtml, {})).toBe('custom');
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
pnpm test tests/worker/fingerprintRules.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement Shopify rule**

Create `apps/worker/src/steps/fingerprintRules/shopify.ts`:

```ts
import type { FingerprintRule } from './index.js';

export const shopifyRule: FingerprintRule = {
  platform: 'shopify',
  matches: (html) => {
    if (/<meta\s+name=["']generator["']\s+content=["']Shopify/i.test(html)) return true;
    if (/cdn\.shopify\.com/i.test(html)) return true;
    if (/window\.Shopify\s*=/i.test(html)) return true;
    return false;
  },
};
```

- [ ] **Step 5: Implement registry**

Create `apps/worker/src/steps/fingerprintRules/index.ts`:

```ts
import type { PlatformValue } from '@shoppingmate/db/schema';
import { shopifyRule } from './shopify.js';

export type FingerprintRule = {
  platform: Exclude<PlatformValue, 'custom'>;
  matches: (html: string, headers: Record<string, string>) => boolean;
};

export const rules: FingerprintRule[] = [shopifyRule];

export function detectPlatform(
  html: string,
  headers: Record<string, string>,
): PlatformValue {
  for (const rule of rules) {
    if (rule.matches(html, headers)) return rule.platform;
  }
  return 'custom';
}
```

- [ ] **Step 6: Run, expect pass**

```bash
pnpm test tests/worker/fingerprintRules.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/steps/fingerprintRules/ tests/fixtures/shopifyHomepage.html tests/fixtures/customHomepage.html tests/worker/fingerprintRules.test.ts
git commit -m "feat(worker): add Shopify fingerprint rule and platform registry"
```

---

## Task 15: Fingerprint rule — WooCommerce

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/woocommerce.ts`
- Modify: `apps/worker/src/steps/fingerprintRules/index.ts`
- Create: `tests/fixtures/wooHomepage.html`
- Modify: `tests/worker/fingerprintRules.test.ts`

- [ ] **Step 1: Write fixture**

Create `tests/fixtures/wooHomepage.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="generator" content="WooCommerce 8.5.0" />
    <script src="/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js"></script>
  </head>
  <body class="home woocommerce-no-js">
    <h1>Acme Woo</h1>
  </body>
</html>
```

- [ ] **Step 2: Add failing tests**

Append to `tests/worker/fingerprintRules.test.ts`:

```ts
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');

describe('detectPlatform — WooCommerce', () => {
  it('detects Woo by generator meta', () => {
    expect(detectPlatform(wooHtml, {})).toBe('woocommerce');
  });

  it('detects Woo by woocommerce body class', () => {
    const html = '<html><body class="woocommerce">x</body></html>';
    expect(detectPlatform(html, {})).toBe('woocommerce');
  });

  it('detects Woo by wp-content/plugins/woocommerce path', () => {
    const html = '<html><body><script src="/wp-content/plugins/woocommerce/x.js"></script></body></html>';
    expect(detectPlatform(html, {})).toBe('woocommerce');
  });

  it('Shopify wins when both signals are present (Shopify rule registered first)', () => {
    const html = '<html><body class="woocommerce"><script>window.Shopify={};</script></body></html>';
    expect(detectPlatform(html, {})).toBe('shopify');
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
pnpm test tests/worker/fingerprintRules.test.ts
```

Expected: 3 of 4 new tests fail (custom fallback returns `custom` for these inputs because Woo rule isn't registered yet).

- [ ] **Step 4: Implement Woo rule**

Create `apps/worker/src/steps/fingerprintRules/woocommerce.ts`:

```ts
import type { FingerprintRule } from './index.js';

export const woocommerceRule: FingerprintRule = {
  platform: 'woocommerce',
  matches: (html) => {
    if (/<meta\s+name=["']generator["']\s+content=["']WooCommerce/i.test(html)) return true;
    if (/wp-content\/plugins\/woocommerce/i.test(html)) return true;
    if (/<body[^>]*class=["'][^"']*\bwoocommerce\b[^"']*["']/i.test(html)) return true;
    return false;
  },
};
```

- [ ] **Step 5: Register Woo rule**

Update `apps/worker/src/steps/fingerprintRules/index.ts`:

```ts
import type { PlatformValue } from '@shoppingmate/db/schema';
import { shopifyRule } from './shopify.js';
import { woocommerceRule } from './woocommerce.js';

export type FingerprintRule = {
  platform: Exclude<PlatformValue, 'custom'>;
  matches: (html: string, headers: Record<string, string>) => boolean;
};

export const rules: FingerprintRule[] = [shopifyRule, woocommerceRule];

export function detectPlatform(
  html: string,
  headers: Record<string, string>,
): PlatformValue {
  for (const rule of rules) {
    if (rule.matches(html, headers)) return rule.platform;
  }
  return 'custom';
}
```

- [ ] **Step 6: Run, expect pass**

```bash
pnpm test tests/worker/fingerprintRules.test.ts
```

Expected: PASS (7/7 across both describe blocks).

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/steps/fingerprintRules/woocommerce.ts apps/worker/src/steps/fingerprintRules/index.ts tests/fixtures/wooHomepage.html tests/worker/fingerprintRules.test.ts
git commit -m "feat(worker): add WooCommerce fingerprint rule"
```

---

## Task 16: Fingerprint step — fetch homepage + run rules

**Files:**
- Modify: `apps/worker/package.json` — add `msw` devDep
- Create: `apps/worker/src/steps/fingerprint.ts`
- Create: `tests/worker/fingerprint.test.ts`

- [ ] **Step 1: Add msw dependency**

```bash
pnpm --filter @shoppingmate/worker add -D msw@^2.6.0
```

Expected: msw installed.

- [ ] **Step 2: Write failing test**

Create `tests/worker/fingerprint.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fingerprint } from '../../apps/worker/src/steps/fingerprint.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fingerprint', () => {
  it('returns shopify on a Shopify homepage', async () => {
    server.use(http.get('https://shop.test/', () => HttpResponse.html(shopifyHtml)));
    expect(await fingerprint('shop.test')).toBe('shopify');
  });

  it('returns woocommerce on a Woo homepage', async () => {
    server.use(http.get('https://woo.test/', () => HttpResponse.html(wooHtml)));
    expect(await fingerprint('woo.test')).toBe('woocommerce');
  });

  it('returns custom when no rule matches', async () => {
    server.use(http.get('https://custom.test/', () => HttpResponse.html(customHtml)));
    expect(await fingerprint('custom.test')).toBe('custom');
  });

  it('throws on network failure (so caller / BullMQ can retry)', async () => {
    server.use(http.get('https://broken.test/', () => HttpResponse.error()));
    await expect(fingerprint('broken.test')).rejects.toThrow();
  });

  it('throws on 5xx', async () => {
    server.use(http.get('https://oops.test/', () => new HttpResponse(null, { status: 503 })));
    await expect(fingerprint('oops.test')).rejects.toThrow(/503/);
  });

  it('caps body size and still classifies', async () => {
    // 3MB of harmless content; should be truncated and classified as custom
    const big = '<html>' + 'x'.repeat(3_000_000) + '</html>';
    server.use(http.get('https://big.test/', () => HttpResponse.html(big)));
    expect(await fingerprint('big.test')).toBe('custom');
  });
});
```

- [ ] **Step 3: Run, expect fail**

```bash
pnpm test tests/worker/fingerprint.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement fingerprint step**

Create `apps/worker/src/steps/fingerprint.ts`:

```ts
import type { PlatformValue } from '@shoppingmate/db/schema';
import { detectPlatform } from './fingerprintRules/index.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB
const FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export async function fingerprint(domain: string): Promise<PlatformValue> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://${domain}/`, {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status}`);
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    const reader = res.body?.getReader();
    if (!reader) return detectPlatform('', headers);

    const decoder = new TextDecoder('utf-8');
    let html = '';
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes >= MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
    }
    html += decoder.decode();

    return detectPlatform(html, headers);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Run, expect pass**

```bash
pnpm test tests/worker/fingerprint.test.ts
```

Expected: PASS (6/6).

- [ ] **Step 6: Commit**

```bash
git add apps/worker/package.json apps/worker/src/steps/fingerprint.ts tests/worker/fingerprint.test.ts
git commit -m "feat(worker): fingerprint step fetches homepage and runs platform rules"
```

---

## Task 17: SafetyCheck step

**Files:**
- Create: `apps/worker/src/steps/safetyCheck.ts`
- Create: `tests/worker/safetyCheck.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/worker/safetyCheck.test.ts`:

```ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { safetyCheck } from '../../apps/worker/src/steps/safetyCheck.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SAFE_BROWSING_URL =
  'https://safebrowsing.googleapis.com/v4/threatMatches:find';

describe('safetyCheck', () => {
  it('returns clean when API responds with no matches', async () => {
    server.use(http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})));
    const result = await safetyCheck('safe.test');
    expect(result).toEqual({ kind: 'clean' });
  });

  it('returns flagged when API returns matches', async () => {
    server.use(
      http.post(SAFE_BROWSING_URL, () =>
        HttpResponse.json({
          matches: [
            { threatType: 'MALWARE', platformType: 'ANY_PLATFORM', threat: { url: 'https://malware.test/' } },
          ],
        }),
      ),
    );
    const result = await safetyCheck('malware.test');
    expect(result).toEqual({ kind: 'flagged', threatType: 'MALWARE' });
  });

  it('throws after 3 transport failures (caller decides to BullMQ-retry)', async () => {
    let calls = 0;
    server.use(
      http.post(SAFE_BROWSING_URL, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    await expect(safetyCheck('flaky.test')).rejects.toThrow();
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('returns clean when API key is missing (degraded mode logged)', async () => {
    // Explicitly set env to empty for this test scope
    const original = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    process.env.GOOGLE_SAFE_BROWSING_API_KEY = '';
    try {
      const result = await safetyCheck('nokey.test');
      expect(result).toEqual({ kind: 'clean' });
    } finally {
      process.env.GOOGLE_SAFE_BROWSING_API_KEY = original ?? '';
    }
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm test tests/worker/safetyCheck.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement safetyCheck**

Create `apps/worker/src/steps/safetyCheck.ts`:

```ts
import { childLogger, env } from '@shoppingmate/shared';

const log = childLogger({ step: 'safetyCheck' });
const API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const TIMEOUT_MS = 3_000;
const MAX_ATTEMPTS = 3;

export type SafetyResult = { kind: 'clean' } | { kind: 'flagged'; threatType: string };

export async function safetyCheck(domain: string): Promise<SafetyResult> {
  if (!env.GOOGLE_SAFE_BROWSING_API_KEY) {
    log.warn({ domain }, 'GOOGLE_SAFE_BROWSING_API_KEY missing; skipping check (degraded)');
    return { kind: 'clean' };
  }

  const body = {
    client: { clientId: 'shoppingmate', clientVersion: '0.1.0' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: `https://${domain}/` }, { url: `http://${domain}/` }],
    },
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_URL}?key=${env.GOOGLE_SAFE_BROWSING_API_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`safe browsing http ${res.status}`);
      const json = (await res.json()) as { matches?: Array<{ threatType: string }> };
      if (json.matches && json.matches.length > 0) {
        const threatType = json.matches[0]?.threatType ?? 'UNKNOWN';
        return { kind: 'flagged', threatType };
      }
      return { kind: 'clean' };
    } catch (err) {
      lastErr = err;
      log.warn({ domain, attempt, err: (err as Error).message }, 'safe browsing call failed');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `safety check failed after ${MAX_ATTEMPTS} attempts: ${
      (lastErr as Error)?.message ?? 'unknown'
    }`,
  );
}
```

Note: `safetyCheck` returns `{kind:'clean'}` when the API key is unset so local dev (without a real Google Cloud project) still works end-to-end. In production deploys the key is required and a missing key is logged at warn level.

- [ ] **Step 4: Run, expect pass**

```bash
pnpm test tests/worker/safetyCheck.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/safetyCheck.ts tests/worker/safetyCheck.test.ts
git commit -m "feat(worker): add safety-check step with retries and degraded fallback"
```

---

## Task 18: Onboarding handler — wire steps + write final state

**Files:**
- Create: `apps/worker/src/handlers/onboarding.ts`

- [ ] **Step 1: Implement handler**

Create `apps/worker/src/handlers/onboarding.ts`:

```ts
import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import type { Job } from 'bullmq';
import { fingerprint } from '../steps/fingerprint.js';
import { safetyCheck } from '../steps/safetyCheck.js';

const log = childLogger({ handler: 'onboarding' });

const PLATFORM_TO_ADAPTER: Record<string, schema.AdapterType> = {
  shopify: 'shopify',
  woocommerce: 'woo',
  custom: 'dom',
};

async function emitMetric(merchantId: string, metricName: string): Promise<void> {
  await db.insert(schema.metricEvents).values({ merchantId, metricName });
}

async function fail(merchantId: string, step: string, err: Error): Promise<void> {
  await db
    .update(schema.merchants)
    .set({ status: 'failed', lastError: `${step}: ${err.message}` })
    .where(eq(schema.merchants.id, merchantId));
  await db.insert(schema.metricEvents).values({
    merchantId,
    metricName: schema.metricNames.onboardingFailed,
    tags: { step },
  });
}

export async function onboardingHandler(job: Job<{ merchantId: string; domain: string }>): Promise<void> {
  const { merchantId, domain } = job.data;
  const start = Date.now();
  log.info({ jobId: job.id, merchantId, domain }, 'onboarding job started');

  // Step 1 — SafetyCheck
  let safety: Awaited<ReturnType<typeof safetyCheck>>;
  try {
    safety = await safetyCheck(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyError);
    log.error({ merchantId, err: (err as Error).message }, 'safety check error');
    throw err; // BullMQ will retry
  }

  if (safety.kind === 'flagged') {
    await db
      .update(schema.merchants)
      .set({ status: 'rejected', lastError: `safety: ${safety.threatType}` })
      .where(eq(schema.merchants.id, merchantId));
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyRejected);
    log.warn({ merchantId, threatType: safety.threatType }, 'merchant rejected by safety check');
    return; // terminal — do not retry, do not fingerprint
  }

  await db
    .update(schema.merchants)
    .set({ safetyCheckedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingSafetyCleared);

  // Step 2 — Fingerprint
  let platform: schema.PlatformValue;
  try {
    platform = await fingerprint(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingFingerprintFetchFailed);
    log.error({ merchantId, err: (err as Error).message }, 'fingerprint fetch failed');
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await fail(merchantId, 'fingerprint', err as Error);
    }
    throw err; // BullMQ retries until exhausted
  }

  const platformMetric =
    platform === 'shopify'
      ? schema.metricNames.onboardingFingerprintShopify
      : platform === 'woocommerce'
        ? schema.metricNames.onboardingFingerprintWoocommerce
        : schema.metricNames.onboardingFingerprintCustom;
  await emitMetric(merchantId, platformMetric);

  // Step 3 — Finalize
  const adapterType = PLATFORM_TO_ADAPTER[platform];
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      platform,
      adapterType,
      lastFingerprintedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));

  await db.insert(schema.metricEvents).values({
    merchantId,
    metricName: schema.metricNames.onboardingCompleted,
    tags: { platform, durationMs: Date.now() - start },
  });
  log.info({ merchantId, platform, durationMs: Date.now() - start }, 'onboarding complete');
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @shoppingmate/worker typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/handlers/onboarding.ts
git commit -m "feat(worker): add onboarding handler wiring safety + fingerprint + finalize"
```

---

## Task 19: Replace worker stub with real handler

**Files:**
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Replace `apps/worker/src/index.ts`**

```ts
import { type OnboardingJobData, createRedisConnection } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { Worker } from 'bullmq';
import { onboardingHandler } from './handlers/onboarding.js';

const worker = new Worker<OnboardingJobData>(
  'onboarding',
  async (job) => {
    await onboardingHandler(job);
  },
  {
    connection: createRedisConnection(),
    concurrency: 4,
  },
);

worker.on('ready', () => logger.info('worker ready'));
worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'job failed'));

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

Concurrency raised from 1 to 4 — onboarding jobs are I/O-bound (HTTP calls), 4 in-flight is safe.

- [ ] **Step 2: Configure default job options on the queue**

Modify `packages/jobs/src/queues.ts`:

```ts
import { Queue } from 'bullmq';
import { createRedisConnection } from './connection.js';

export type OnboardingJobData = { merchantId: string; domain: string };

export const onboardingQueue = new Queue<OnboardingJobData>('onboarding', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});
```

- [ ] **Step 3: Lint, typecheck, build**

```bash
pnpm lint:fix && pnpm typecheck && pnpm --filter @shoppingmate/worker build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/index.ts packages/jobs/src/queues.ts
git commit -m "feat(worker): replace stub with real onboarding handler; add retry policy"
```

---

## Task 20: Integration test — end-to-end onboarding

**Files:**
- Create: `tests/worker/onboarding.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/worker/onboarding.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { onboardingHandler } from '../../apps/worker/src/handlers/onboarding.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function provision(domain: string): Promise<string> {
  const id = generateMerchantId();
  await db.insert(schema.merchants).values({
    id,
    domain,
    allowedDomains: [domain],
    status: 'onboarding',
    lastInstallAt: new Date(),
  });
  return id;
}

async function cleanup(merchantId: string): Promise<void> {
  await db.delete(schema.metricEvents).where(eq(schema.metricEvents.merchantId, merchantId));
  await db.delete(schema.installAttempts).where(eq(schema.installAttempts.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
}

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

function fakeJob(merchantId: string, domain: string) {
  return {
    id: 'test-job',
    data: { merchantId, domain },
    attemptsMade: 0,
    opts: { attempts: 5 },
  } as unknown as Parameters<typeof onboardingHandler>[0];
}

describe('onboardingHandler', () => {
  beforeEach(() => {
    process.env.GOOGLE_SAFE_BROWSING_API_KEY = 'test-key';
  });

  it('happy path: safe + Shopify → status=live, platform=shopify', async () => {
    const domain = 'shopify-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(shopifyHtml)),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('shopify');
    expect(m?.adapterType).toBe('shopify');
    expect(m?.safetyCheckedAt).toBeInstanceOf(Date);
    expect(m?.lastFingerprintedAt).toBeInstanceOf(Date);

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.safety.cleared');
    expect(names).toContain('onboarding.fingerprint.shopify');
    expect(names).toContain('onboarding.completed');

    await cleanup(id);
  });

  it('safety flagged → status=rejected, no fingerprint', async () => {
    const domain = 'flagged.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () =>
        HttpResponse.json({ matches: [{ threatType: 'MALWARE' }] }),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('rejected');
    expect(m?.lastError).toContain('MALWARE');
    expect(m?.platform).toBeNull();

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.safety.rejected');
    expect(names.find((n) => n.startsWith('onboarding.fingerprint'))).toBeUndefined();

    await cleanup(id);
  });

  it('custom site → platform=custom, adapter=dom', async () => {
    const domain = 'custom-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(customHtml)),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');

    await cleanup(id);
  });

  it('fingerprint fetch failure on final attempt → status=failed', async () => {
    const domain = 'flaky.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.error()),
    );

    const finalJob = {
      id: 'final',
      data: { merchantId: id, domain },
      attemptsMade: 4,
      opts: { attempts: 5 },
    } as unknown as Parameters<typeof onboardingHandler>[0];

    await expect(onboardingHandler(finalJob)).rejects.toThrow();

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('failed');
    expect(m?.lastError).toContain('fingerprint');

    await cleanup(id);
  });
});
```

- [ ] **Step 2: Run, expect pass**

```bash
pnpm test tests/worker/onboarding.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 3: Run full suite**

```bash
pnpm test
```

Expected: all green. Total ≈ 35 tests across Plan 1 + Plan 2.

- [ ] **Step 4: Commit**

```bash
git add tests/worker/onboarding.test.ts
git commit -m "test(worker): integration tests for onboarding handler end-to-end"
```

---

## Task 21: Manual smoke script for Safe Browsing

**Files:**
- Create: `scripts/smoke-safety.ts`

- [ ] **Step 1: Create the script**

Create `scripts/smoke-safety.ts`:

```ts
#!/usr/bin/env node
import { safetyCheck } from '../apps/worker/src/steps/safetyCheck.js';

const TEST_THREAT = 'testsafebrowsing.appspot.com';
const TEST_CLEAN = 'example.com';

async function main(): Promise<void> {
  console.log(`Checking known-malicious test domain: ${TEST_THREAT}`);
  const flagged = await safetyCheck(TEST_THREAT);
  console.log('  result:', flagged);
  if (flagged.kind !== 'flagged') {
    console.error('  ❌ EXPECTED FLAGGED — check API key and quota');
    process.exitCode = 1;
  } else {
    console.log('  ✅ OK');
  }

  console.log(`\nChecking known-clean control domain: ${TEST_CLEAN}`);
  const clean = await safetyCheck(TEST_CLEAN);
  console.log('  result:', clean);
  if (clean.kind !== 'clean') {
    console.error('  ❌ EXPECTED CLEAN — investigate');
    process.exitCode = 1;
  } else {
    console.log('  ✅ OK');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add a root script entry**

In repo root `package.json`, append to `scripts`:

```json
    "smoke:safety": "tsx --env-file-if-exists=.env scripts/smoke-safety.ts"
```

- [ ] **Step 3: Manual run (only when you have a real API key)**

If `.env` has `GOOGLE_SAFE_BROWSING_API_KEY` set, run:

```bash
pnpm smoke:safety
```

Expected: prints `flagged` for the test threat domain and `clean` for `example.com`. If the key is unset, the script prints `clean` for both (degraded mode warned in safetyCheck) — this is fine for CI, just note the script's purpose is manual verification.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-safety.ts package.json
git commit -m "chore: add manual smoke script for Safe Browsing integration"
```

---

## Task 22: README updates + final acceptance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Plan 2 sections to README**

In `README.md`, after the existing "Common commands" table, append:

````markdown
## Provisioning a beta merchant (Phase 1)

Self-service signup arrives in Phase 2 with the dashboard. For Phase 1, the team provisions merchants via CLI.

```bash
# Create a merchant; prints the install snippet
pnpm shoppingmate:dev provision --domain=acmesoap.com --name="Acme Soap"

# Inspect a merchant's row + last 5 install attempts
pnpm shoppingmate:dev show SM-A7K2X9

# Force re-onboarding (e.g. after fixing a transient issue)
pnpm shoppingmate:dev retry-onboarding SM-A7K2X9
```

After provisioning, paste the printed `<script>` snippet into the brand's `<head>`. The first shopper to load the page calls `POST /v1/install`, which kicks off the SafetyCheck + platform fingerprint pipeline. The merchant transitions through `pending → onboarding → live` (or `rejected` / `failed`).

## /v1/install (gtag endpoint)

Public endpoint called by the gtag from shoppers' browsers.

```http
POST /v1/install
Origin: https://<merchant-domain>
Content-Type: application/json

{ "merchantId": "SM-...", "domain": "<merchant-domain>", "userAgent": "...", "referrer": "..." }
```

Returns `200 { status: "pending" | "onboarding" | "live" | "failed" | "rejected" }`. Validates `Origin`/`Referer` host equals body domain, rate-limits per merchantId (10/min) and source IP (100/min), and rejects domains not in the merchant's `allowed_domains` allowlist.
````

- [ ] **Step 2: Acceptance — full pipeline smoke**

This step exercises the full Plan 2 acceptance from the spec. In one terminal:

```bash
docker compose up -d
pnpm db:migrate
pnpm dev
```

In a second terminal:

```bash
# Provision
pnpm shoppingmate:dev provision --domain=example.com --name="Acceptance"
# Note SM-XXXXXX from output

# First call — should enqueue and return onboarding
curl -i -X POST http://127.0.0.1:3000/v1/install \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://example.com' \
  -d '{"merchantId":"SM-XXXXXX","domain":"example.com","userAgent":"acc","referrer":null}'
# Expect: HTTP 200 {"status":"onboarding"}

# Wait ~10s for the worker to fetch example.com, fingerprint, and write status=live
sleep 10

# Second call — should now report live (example.com fingerprints as 'custom')
curl -i -X POST http://127.0.0.1:3000/v1/install \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://example.com' \
  -d '{"merchantId":"SM-XXXXXX","domain":"example.com","userAgent":"acc","referrer":null}'
# Expect: HTTP 200 {"status":"live"}

# Negative: mismatched origin
curl -i -X POST http://127.0.0.1:3000/v1/install \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://evil.com' \
  -d '{"merchantId":"SM-XXXXXX","domain":"example.com","userAgent":"acc","referrer":null}'
# Expect: HTTP 403 {"error":"origin_mismatch", ...}

# Verify final state
pnpm shoppingmate:dev show SM-XXXXXX
# Expect: status=live, platform=custom, safety_checked_at set, last_fingerprinted_at set
```

Clean up:

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "DELETE FROM merchants WHERE domain='example.com';"
```

- [ ] **Step 3: Verify all checks pass**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: every command exits 0.

- [ ] **Step 4: Commit + tag**

```bash
git add README.md
git commit -m "docs: document provisioning CLI and /v1/install endpoint"
git tag phase1-plan2-provisioning-complete
```

---

## Self-review notes

**Spec coverage:** all 11 acceptance criteria from spec §10 are exercised — tasks 4 (snippet), 13 (validation tests), 20 (worker tests), 22 (full pipeline acceptance). Schema changes from spec §5 land in Task 1. Security checks from §6 implemented in Tasks 9+11+12. Observability constants from §7 added in Task 2 and emitted in Task 18. Out-of-scope items (catalog sync, adapters) intentionally omitted.

**Scope:** single subsystem — provisioning + lifecycle. No decomposition needed.

**Status terminology:** spec used `'active'`; existing Plan 1 schema used `'live'`. Plan reconciles by using `'live'` everywhere (also what Plan 3+ catalog sync will read). The spec's `'active'` references should be read as `'live'` — noted in plan header.

**Type consistency:** `MerchantStatus`, `PlatformValue`, `AdapterType`, `InstallOutcome`, `InstallAction` all defined exactly once; usages in later tasks reference the canonical definition.

**No placeholders.** Each step contains real code, real commands, and concrete expected output.
