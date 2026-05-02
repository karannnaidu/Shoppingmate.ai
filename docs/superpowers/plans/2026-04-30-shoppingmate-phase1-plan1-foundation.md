# shoppingmate.ai Phase 1 — Plan 1: Foundation & Infra

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo skeleton, local dev infra, database schema, env management, logging, test runner, lint/format, and CI scaffold — so every later plan has a working surface to build against.

**Architecture:** TypeScript monorepo via `pnpm workspaces`. Two apps (`api`, `worker`) and three packages (`db`, `shared`, `jobs`). Local dev runs Postgres 16 + Redis 7 + MinIO via Docker Compose. Drizzle ORM + drizzle-kit for migrations. Hono on top of `@hono/node-server` for HTTP (uWebSockets.js wiring deferred to Plan 7 when we add WS). BullMQ for jobs. Vitest for tests. Biome for lint/format. Pino for logs. GitHub Actions for CI.

**Tech Stack:** Node.js 20 LTS, TypeScript 5.x, pnpm 9, Hono, Drizzle ORM, BullMQ, Vitest, Biome, Pino, envalid, Postgres 16, Redis 7, MinIO, Docker Compose, GitHub Actions.

**Out of scope for this plan:** WebSocket server (Plan 7), uWebSockets.js (Plan 7), provisioning logic (Plan 2), onboarding logic (Plan 3), adapters (Plans 4–6), gtag bundle (Plan 8), CDN deploy (Plan 8). Hosting target (Fly.io vs Hetzner) — local dev only here.

**Acceptance:** `pnpm install && docker compose up -d && pnpm db:migrate && pnpm dev` boots the API on :3000 and a worker process. `curl localhost:3000/health` returns `{"ok":true}`. `pnpm test` passes. `pnpm lint` is clean. `pnpm build` produces dist output for both apps. CI on a fresh PR runs all of the above and is green.

---

## File structure

```
shoppingmate/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts                  # boot Hono server
│   │   │   └── routes/
│   │   │       └── health.ts             # GET /health
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── worker/
│       ├── src/
│       │   └── index.ts                  # boot BullMQ worker process (one stub queue)
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── client.ts                 # drizzle Postgres client factory
│   │   │   ├── schema/
│   │   │   │   ├── merchants.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── selectorCache.ts
│   │   │   │   ├── conversionEvents.ts
│   │   │   │   ├── billingLedger.ts
│   │   │   │   └── index.ts              # re-exports
│   │   │   └── index.ts                  # public surface
│   │   ├── drizzle/                      # generated migrations
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared/
│   │   ├── src/
│   │   │   ├── env.ts                    # envalid validation
│   │   │   ├── logger.ts                 # pino factory
│   │   │   ├── ids.ts                    # generateMerchantId() → 'SM-XXXXXX'
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── jobs/
│       ├── src/
│       │   ├── connection.ts             # ioredis connection for BullMQ
│       │   ├── queues.ts                 # exports `onboardingQueue` (stub)
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docker-compose.yml                    # postgres + redis + minio
├── .nvmrc                                # 20
├── .gitignore
├── .env.example
├── biome.json
├── tsconfig.base.json
├── vitest.config.ts                      # root config; apps inherit
├── pnpm-workspace.yaml
├── package.json                          # root scripts
└── README.md
```

---

## Task 1: Initialise repo, git, and pnpm workspace

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore`, `README.md`

- [ ] **Step 1: Init git**

```bash
cd "C:/Users/naidu/Downloads/Personal Agentic shopper"
git init
git branch -M main
```

- [ ] **Step 2: Write `.nvmrc`**

```
20
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
dist/
.env
.env.local
.env.*.local
coverage/
*.log
.DS_Store
.turbo
.vitest-cache/
drizzle/meta/
playwright-report/
test-results/
```

- [ ] **Step 4: Write root `package.json`**

```json
{
  "name": "shoppingmate",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.0.0 <21" },
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "db:generate": "pnpm --filter @shoppingmate/db db:generate",
    "db:migrate": "pnpm --filter @shoppingmate/db db:migrate",
    "db:studio": "pnpm --filter @shoppingmate/db db:studio"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4",
    "tsx": "^4.19.2"
  }
}
```

- [ ] **Step 5: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 6: Write minimal `README.md`**

```markdown
# shoppingmate.ai

AI sales agent (voice + text) for D2C merchants. One `<script>` tag install.

See `docs/superpowers/roadmap.md` for the product roadmap and `docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md` for the Phase 1 design.

## Quick start

\`\`\`bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
pnpm dev
\`\`\`

API: http://localhost:3000/health
```

- [ ] **Step 7: Verify**

```bash
pnpm install
```
Expected: lockfile created at `pnpm-lock.yaml`, no errors.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .nvmrc package.json pnpm-workspace.yaml README.md pnpm-lock.yaml
git commit -m "chore: init monorepo skeleton with pnpm workspace"
```

---

## Task 2: Base TypeScript config + Biome lint/format

**Files:**
- Create: `tsconfig.base.json`, `biome.json`

- [ ] **Step 1: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignore": ["dist", "node_modules", "drizzle/meta", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error"
      }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" }
  }
}
```

- [ ] **Step 3: Verify**

```bash
pnpm lint
```
Expected: `Checked 0 files in <Xms>. No fixes applied.` (no files yet)

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json biome.json
git commit -m "chore: add base tsconfig and biome lint/format config"
```

---

## Task 3: Docker Compose for local dev (Postgres + Redis + MinIO)

**Files:**
- Create: `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: sm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: shoppingmate
      POSTGRES_PASSWORD: shoppingmate_dev
      POSTGRES_DB: shoppingmate
    ports: ["5432:5432"]
    volumes:
      - sm_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shoppingmate -d shoppingmate"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: sm_redis
    restart: unless-stopped
    ports: ["6379:6379"]
    volumes:
      - sm_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: sm_minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: shoppingmate
      MINIO_ROOT_PASSWORD: shoppingmate_dev
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - sm_minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  sm_postgres_data:
  sm_redis_data:
  sm_minio_data:
```

- [ ] **Step 2: Write `.env.example`**

```
NODE_ENV=development
LOG_LEVEL=info

# Postgres
DATABASE_URL=postgres://shoppingmate:shoppingmate_dev@localhost:5432/shoppingmate

# Redis
REDIS_URL=redis://localhost:6379

# Object storage (MinIO local; R2 in prod)
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_ACCESS_KEY_ID=shoppingmate
S3_SECRET_ACCESS_KEY=shoppingmate_dev
S3_BUCKET=shoppingmate-dev

# API
API_PORT=3000

# External (leave blank for Plan 1; populated in later plans)
OPENROUTER_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_API_KEY=
GOOGLE_SAFE_BROWSING_API_KEY=
```

- [ ] **Step 3: Bring up services and verify**

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```
Expected: three services with `(healthy)` status within ~30s.

- [ ] **Step 4: Verify Postgres reachable**

```bash
docker exec sm_postgres psql -U shoppingmate -d shoppingmate -c "SELECT 1"
```
Expected: `1` row, no error.

- [ ] **Step 5: Verify Redis reachable**

```bash
docker exec sm_redis redis-cli ping
```
Expected: `PONG`

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add docker-compose with postgres/redis/minio for local dev"
```

---

## Task 4: `packages/shared` — env validation + logger + ID generator

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/{env.ts,logger.ts,ids.ts,index.ts}`
- Test: `packages/shared/src/ids.test.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@shoppingmate/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "envalid": "^8.0.0",
    "pino": "^9.5.0",
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Install deps**

```bash
pnpm install
```

- [ ] **Step 4: Write the failing test for `generateMerchantId`**

`packages/shared/src/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { generateMerchantId } from './ids.js';

describe('generateMerchantId', () => {
  it('returns a string starting with SM-', () => {
    const id = generateMerchantId();
    expect(id.startsWith('SM-')).toBe(true);
  });

  it('has 6 alphanumeric characters after the prefix', () => {
    const id = generateMerchantId();
    const suffix = id.slice(3);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('produces different ids on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateMerchantId()));
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
pnpm test
```
Expected: FAIL — `Cannot find module './ids.js'`.

- [ ] **Step 6: Implement `packages/shared/src/ids.ts`**

```ts
import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Crockford-ish (no I,O,0,1)
const suffix = customAlphabet(alphabet, 6);

export function generateMerchantId(): string {
  return `SM-${suffix()}`;
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pnpm test
```
Expected: 3 passed.

- [ ] **Step 8: Implement `packages/shared/src/env.ts`**

```ts
import { cleanEnv, num, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  LOG_LEVEL: str({ choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'], default: 'info' }),
  DATABASE_URL: str(),
  REDIS_URL: str(),
  S3_ENDPOINT: str(),
  S3_REGION: str({ default: 'auto' }),
  S3_ACCESS_KEY_ID: str(),
  S3_SECRET_ACCESS_KEY: str(),
  S3_BUCKET: str(),
  API_PORT: port({ default: 3000 }),
  OPENROUTER_API_KEY: str({ default: '' }),
  ELEVENLABS_API_KEY: str({ default: '' }),
  OPENAI_API_KEY: str({ default: '' }),
  GOOGLE_SAFE_BROWSING_API_KEY: str({ default: '' }),
});

export type Env = typeof env;
```

- [ ] **Step 9: Implement `packages/shared/src/logger.ts`**

```ts
import { pino } from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: undefined },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
```

- [ ] **Step 10: Implement `packages/shared/src/index.ts`**

```ts
export { env } from './env.js';
export type { Env } from './env.js';
export { logger, childLogger } from './logger.js';
export { generateMerchantId } from './ids.js';
```

- [ ] **Step 11: Run typecheck**

```bash
pnpm --filter @shoppingmate/shared typecheck
```
Expected: no errors.

- [ ] **Step 12: Run tests + lint**

```bash
pnpm test && pnpm lint
```
Expected: 3 passed, lint clean.

- [ ] **Step 13: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add env validation, pino logger, and merchant ID generator"
```

---

## Task 5: `packages/db` — Drizzle setup + first schema files

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/client.ts`, `packages/db/src/schema/{merchants,products,selectorCache,conversionEvents,billingLedger,index}.ts`, `packages/db/src/index.ts`

- [ ] **Step 1: Write `packages/db/package.json`**

```json
{
  "name": "@shoppingmate/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts", "./schema": "./src/schema/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx ./src/migrate.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@shoppingmate/shared": "workspace:*",
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Write `packages/db/src/schema/merchants.ts`** (mirrors spec §11.1)

```ts
import { boolean, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const merchantStatus = ['onboarding', 'live', 'degraded', 'suspended'] as const;
export type MerchantStatus = typeof merchantStatus[number];

export const adapterTypes = [
  'shopify', 'woo', 'magento', 'bigcommerce', 'wix', 'squarespace', 'dom', 'suggest',
] as const;
export type AdapterType = typeof adapterTypes[number];

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  platform: text('platform'),
  platformConfidence: numeric('platform_confidence'),
  status: text('status').$type<MerchantStatus>().notNull(),
  adapterType: text('adapter_type').$type<AdapterType>().notNull(),
  adapterConfig: jsonb('adapter_config').notNull().default({}),
  cartUrlTemplate: text('cart_url_template'),
  checkoutUrl: text('checkout_url'),
  couponFieldSelector: text('coupon_field_selector'),
  policyUrls: jsonb('policy_urls'),
  personaId: text('persona_id').default('concierge').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
```

- [ ] **Step 5: Write `packages/db/src/schema/products.ts`**

```ts
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const products = pgTable('products', {
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  productUrl: text('product_url').notNull(),
  variants: jsonb('variants'),
  priceCents: integer('price_cents'),
  currency: text('currency'),
  inStock: boolean('in_stock'),
  indexedAt: timestamp('indexed_at', { withTimezone: true }),
  source: text('source'),
}, (t) => ({ pk: primaryKey({ columns: [t.merchantId, t.sku] }) }));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

- [ ] **Step 6: Write `packages/db/src/schema/selectorCache.ts`**

```ts
import { boolean, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const selectorSources = ['auto', 'llm_resolved', 'merchant_override'] as const;
export type SelectorSource = typeof selectorSources[number];

export const selectorCache = pgTable('selector_cache', {
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  pageTemplateHash: text('page_template_hash').notNull(),
  selectorKey: text('selector_key').notNull(),
  resolvedSelector: text('resolved_selector').notNull(),
  source: text('source').$type<SelectorSource>().notNull(),
  locked: boolean('locked').notNull().default(false),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastTestPassed: boolean('last_test_passed'),
}, (t) => ({ pk: primaryKey({ columns: [t.merchantId, t.pageTemplateHash, t.selectorKey] }) }));

export type SelectorCacheRow = typeof selectorCache.$inferSelect;
```

- [ ] **Step 7: Write `packages/db/src/schema/conversionEvents.ts`**

```ts
import { bigserial, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const conversionEvents = pgTable('conversion_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  orderId: text('order_id'),
  totalCents: integer('total_cents'),
  currency: text('currency'),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
});

export type ConversionEvent = typeof conversionEvents.$inferSelect;
```

- [ ] **Step 8: Write `packages/db/src/schema/billingLedger.ts`**

```ts
import { bigint, date, integer, numeric, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const billingLedger = pgTable('billing_ledger', {
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  period: date('period').notNull(),
  conversationsCount: integer('conversations_count').notNull().default(0),
  voiceMinutes: numeric('voice_minutes').notNull().default('0'),
  conversionValueCents: bigint('conversion_value_cents', { mode: 'number' }).notNull().default(0),
  llmCostUsd: numeric('llm_cost_usd').notNull().default('0'),
  sttCostUsd: numeric('stt_cost_usd').notNull().default('0'),
  ttsCostUsd: numeric('tts_cost_usd').notNull().default('0'),
}, (t) => ({ pk: primaryKey({ columns: [t.merchantId, t.period] }) }));

export type BillingLedgerRow = typeof billingLedger.$inferSelect;
```

- [ ] **Step 8b: Write `packages/db/src/schema/metricEvents.ts`** (reliability instrumentation — spec §16.2)

```ts
import { bigserial, jsonb, numeric, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const metricEvents = pgTable('metric_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  metricName: text('metric_name').notNull(),
  value: numeric('value').notNull().default('1'),
  tags: jsonb('tags').$type<Record<string, string | number | boolean>>(),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  merchantMetricTsIdx: index('metric_events_merchant_metric_ts_idx').on(t.merchantId, t.metricName, t.ts.desc()),
}));

export type MetricEvent = typeof metricEvents.$inferSelect;

// Canonical metric names — spec §16.1
export const metricNames = {
  selectorFirstTrySuccess: 'selector.first_try.success',
  selectorFirstTryFail: 'selector.first_try.fail',
  selectorHealAttempted: 'selector.heal.attempted',
  selectorHealSucceeded: 'selector.heal.succeeded',
  selectorOverrideSkipped: 'selector.override.skipped',
  selectorOverrideAlerted: 'selector.override.alerted',
  toolCallDurationMs: 'tool.call.duration_ms',
  voiceNumericPriceCorrected: 'voice.numeric_price_corrected',
} as const;
```

- [ ] **Step 9: Write `packages/db/src/schema/index.ts`**

```ts
export * from './merchants.js';
export * from './products.js';
export * from './selectorCache.js';
export * from './conversionEvents.js';
export * from './billingLedger.js';
export * from './metricEvents.js';
```

- [ ] **Step 10: Write `packages/db/src/client.ts`**

```ts
import { env } from '@shoppingmate/shared';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
```

- [ ] **Step 11: Write `packages/db/src/index.ts`**

```ts
export { db } from './client.js';
export type { DB } from './client.js';
export * as schema from './schema/index.js';
```

- [ ] **Step 12: Write `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 13: Write `packages/db/src/migrate.ts`**

```ts
import { env } from '@shoppingmate/shared';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle' });
await sql.end();
console.log('migrations applied');
```

- [ ] **Step 14: Generate the initial migration**

```bash
pnpm db:generate
```
Expected: `drizzle/0000_<name>.sql` and meta files appear; `pnpm db:generate` reports the schema diff.

- [ ] **Step 15: Apply migrations**

```bash
pnpm db:migrate
```
Expected: console prints `migrations applied`.

- [ ] **Step 16: Verify tables exist in Postgres**

```bash
docker exec sm_postgres psql -U shoppingmate -d shoppingmate -c "\dt"
```
Expected: `merchants`, `products`, `selector_cache`, `conversion_events`, `billing_ledger`, `metric_events`, `__drizzle_migrations` listed.

- [ ] **Step 17: Typecheck**

```bash
pnpm --filter @shoppingmate/db typecheck
```
Expected: no errors.

- [ ] **Step 18: Commit**

```bash
git add packages/db
git commit -m "feat(db): add drizzle schema for merchants/products/selector_cache/conversion_events/billing_ledger"
```

---

## Task 6: `packages/jobs` — BullMQ wiring with one stub queue

**Files:**
- Create: `packages/jobs/package.json`, `packages/jobs/tsconfig.json`, `packages/jobs/src/{connection,queues,index}.ts`
- Test: `packages/jobs/src/queues.test.ts`

- [ ] **Step 1: Write `packages/jobs/package.json`**

```json
{
  "name": "@shoppingmate/jobs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "@shoppingmate/shared": "workspace:*",
    "bullmq": "^5.27.0",
    "ioredis": "^5.4.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `packages/jobs/tsconfig.json`** (same shape as `packages/shared/tsconfig.json`, swap rootDir/include if different — here identical):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Write `packages/jobs/src/connection.ts`**

```ts
import { env } from '@shoppingmate/shared';
import IORedis from 'ioredis';

export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
```

- [ ] **Step 5: Write `packages/jobs/src/queues.ts`**

```ts
import { Queue } from 'bullmq';
import { createRedisConnection } from './connection.js';

export type OnboardingJobData = { merchantId: string; domain: string };

export const onboardingQueue = new Queue<OnboardingJobData>('onboarding', {
  connection: createRedisConnection(),
});
```

- [ ] **Step 6: Write `packages/jobs/src/index.ts`**

```ts
export { createRedisConnection } from './connection.js';
export { onboardingQueue } from './queues.js';
export type { OnboardingJobData } from './queues.js';
```

- [ ] **Step 7: Write the failing test**

`packages/jobs/src/queues.test.ts`:
```ts
import { describe, expect, it, afterAll } from 'vitest';
import { onboardingQueue } from './queues.js';

describe('onboardingQueue', () => {
  afterAll(async () => {
    await onboardingQueue.obliterate({ force: true });
    await onboardingQueue.close();
  });

  it('accepts a job and exposes it via getJob', async () => {
    const job = await onboardingQueue.add('test', { merchantId: 'SM-TEST01', domain: 'example.com' });
    const fetched = await onboardingQueue.getJob(job.id!);
    expect(fetched?.data.merchantId).toBe('SM-TEST01');
  });
});
```

- [ ] **Step 8: Run test (Redis must be up)**

```bash
docker compose ps redis
pnpm test
```
Expected: 1 passed (across all packages so far: 4 passed).

- [ ] **Step 9: Typecheck**

```bash
pnpm --filter @shoppingmate/jobs typecheck
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/jobs
git commit -m "feat(jobs): add bullmq wiring with onboardingQueue stub"
```

---

## Task 7: `apps/api` — Hono server with `/health` route

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/{index,routes/health}.ts`
- Test: `apps/api/src/routes/health.test.ts`

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@shoppingmate/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@shoppingmate/db": "workspace:*",
    "@shoppingmate/jobs": "workspace:*",
    "@shoppingmate/shared": "workspace:*",
    "@hono/node-server": "^1.13.5",
    "hono": "^4.6.10"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Write `apps/api/src/routes/health.ts`**

```ts
import { Hono } from 'hono';

export const healthRoute = new Hono().get('/', (c) => c.json({ ok: true }));
```

- [ ] **Step 5: Write the failing test**

`apps/api/src/routes/health.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { healthRoute } from './health.js';

describe('GET /health', () => {
  it('returns { ok: true }', async () => {
    const res = await healthRoute.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 6: Run test**

```bash
pnpm test
```
Expected: 1 new passing test (5 total).

- [ ] **Step 7: Write `apps/api/src/index.ts`**

```ts
import { serve } from '@hono/node-server';
import { env, logger } from '@shoppingmate/shared';
import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';

const app = new Hono();
app.route('/health', healthRoute);

serve({ fetch: app.fetch, port: env.API_PORT }, ({ port }) => {
  logger.info({ port }, 'api listening');
});
```

- [ ] **Step 8: Boot in dev mode and curl**

In one shell:
```bash
pnpm --filter @shoppingmate/api dev
```
In another shell:
```bash
curl -sS http://localhost:3000/health
```
Expected: `{"ok":true}`

Stop the dev process (Ctrl+C).

- [ ] **Step 9: Build it**

```bash
pnpm --filter @shoppingmate/api build
```
Expected: `apps/api/dist/index.js` produced, no TS errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api
git commit -m "feat(api): add hono server with /health endpoint"
```

---

## Task 8: `apps/worker` — BullMQ worker process boot

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/index.ts`

- [ ] **Step 1: Write `apps/worker/package.json`**

```json
{
  "name": "@shoppingmate/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@shoppingmate/jobs": "workspace:*",
    "@shoppingmate/shared": "workspace:*",
    "bullmq": "^5.27.0"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `apps/worker/tsconfig.json`** (same as api):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

- [ ] **Step 4: Write `apps/worker/src/index.ts`**

```ts
import { logger } from '@shoppingmate/shared';
import { createRedisConnection, type OnboardingJobData } from '@shoppingmate/jobs';
import { Worker } from 'bullmq';

const worker = new Worker<OnboardingJobData>(
  'onboarding',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'onboarding job received (stub)');
    // Real implementation lands in Plan 3.
    return { stub: true };
  },
  { connection: createRedisConnection(), concurrency: 1 },
);

worker.on('ready', () => logger.info('worker ready'));
worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'job failed'));

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

- [ ] **Step 5: Boot the worker, enqueue a job, verify it processes**

In one shell:
```bash
pnpm --filter @shoppingmate/worker dev
```
In another shell, enqueue a job using a one-off script:
```bash
node -e "
import('./packages/jobs/src/index.ts').then(async ({ onboardingQueue }) => {
  const j = await onboardingQueue.add('test', { merchantId: 'SM-XYZ123', domain: 'demo.com' });
  console.log('enqueued', j.id);
  await onboardingQueue.close();
});
" --input-type=module
```

Worker shell expected output: `onboarding job received (stub)` log line with `jobId` and `data`.

Stop the worker (Ctrl+C).

- [ ] **Step 6: Build**

```bash
pnpm --filter @shoppingmate/worker build
```
Expected: `apps/worker/dist/index.js` produced.

- [ ] **Step 7: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): add bullmq worker process consuming onboardingQueue (stub)"
```

---

## Task 9: Root Vitest config + smoke test that env loads

**Files:**
- Create: `vitest.config.ts`
- Test: `tests/smoke.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: false,
    testTimeout: 15000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 2: Write a smoke test that proves env + db client + jobs all import cleanly**

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { env, generateMerchantId, logger } from '@shoppingmate/shared';
import { db } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';

describe('smoke', () => {
  it('env validates', () => {
    expect(env.DATABASE_URL).toMatch(/^postgres:\/\//);
    expect(env.REDIS_URL).toMatch(/^redis:\/\//);
  });

  it('logger is callable', () => {
    expect(typeof logger.info).toBe('function');
  });

  it('generateMerchantId emits SM- prefix', () => {
    expect(generateMerchantId()).toMatch(/^SM-[A-Z0-9]{6}$/);
  });

  it('db client constructed', () => {
    expect(db).toBeDefined();
  });

  it('onboardingQueue constructed', async () => {
    expect(onboardingQueue.name).toBe('onboarding');
    await onboardingQueue.close();
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```
Expected: ~10 passed across all packages, no failures.

- [ ] **Step 4: Run lint and typecheck**

```bash
pnpm lint && pnpm typecheck
```
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts
git commit -m "test: add cross-package smoke test"
```

---

## Task 10: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: shoppingmate
          POSTGRES_PASSWORD: shoppingmate_dev
          POSTGRES_DB: shoppingmate
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U shoppingmate -d shoppingmate"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      NODE_ENV: test
      LOG_LEVEL: warn
      DATABASE_URL: postgres://shoppingmate:shoppingmate_dev@localhost:5432/shoppingmate
      REDIS_URL: redis://localhost:6379
      S3_ENDPOINT: http://localhost:9000
      S3_REGION: auto
      S3_ACCESS_KEY_ID: shoppingmate
      S3_SECRET_ACCESS_KEY: shoppingmate_dev
      S3_BUCKET: shoppingmate-dev
      API_PORT: 3000

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm db:migrate
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions workflow for lint/typecheck/test/build"
```

- [ ] **Step 3: Locally re-verify the same sequence CI runs**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm test
pnpm build
```
Expected: every step exits 0.

---

## Task 11: README polish + completion verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with the full setup doc**

```markdown
# shoppingmate.ai

AI sales agent (voice + text) for D2C merchants. One `<script>` tag install.

- **Roadmap:** [`docs/superpowers/roadmap.md`](docs/superpowers/roadmap.md)
- **Phase 1 spec:** [`docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md`](docs/superpowers/specs/2026-04-30-shoppingmate-phase1-design.md)
- **User journey & architecture map:** [`docs/user-journey-flowchart.md`](docs/user-journey-flowchart.md)

## Repo layout

\`\`\`
apps/
  api/      # Hono HTTP server (provisioning + conversion endpoints)
  worker/   # BullMQ worker (onboarding, smoke tests, [P2] recrawl, KB indexer)
packages/
  db/       # Drizzle schema + client + migrations
  shared/   # env, logger, ID generation
  jobs/     # BullMQ queues + Redis connection
docs/       # roadmap, specs, plans, journey docs
\`\`\`

## Prerequisites

- Node 20.x (see `.nvmrc`)
- pnpm 9.x
- Docker Desktop (or compatible)

## First-time setup

\`\`\`bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
\`\`\`

## Run dev

\`\`\`bash
pnpm dev
\`\`\`

API at http://localhost:3000/health · Worker logs in the same terminal (parallel).

## Common commands

| Command | Purpose |
|---|---|
| `pnpm test` | Run all Vitest tests |
| `pnpm lint` | Biome lint check |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format with Biome |
| `pnpm typecheck` | TS typecheck across all packages |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (browser GUI) |
| `pnpm build` | Build all packages and apps |
\`\`\`

## License

Proprietary — Calmosis.
```

- [ ] **Step 2: Run the acceptance sequence end-to-end**

```bash
docker compose down
docker compose up -d
sleep 10
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
Expected: every command exits 0.

- [ ] **Step 3: Boot dev and curl health**

In one shell:
```bash
pnpm dev
```
In another:
```bash
curl -sS http://localhost:3000/health
```
Expected: `{"ok":true}`. Stop dev with Ctrl+C.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: complete README with setup, layout, and command reference"
```

- [ ] **Step 5: Tag the foundation**

```bash
git tag -a phase1-plan1-foundation-complete -m "Plan 1: Foundation & infra complete"
```

---

## Self-review checklist

**Spec coverage:**
- ✅ Postgres schema for `merchants`, `products`, `selector_cache`, `conversion_events`, `billing_ledger`, `metric_events` (spec §11.1, §16.2) — Task 5
- ✅ Redis available + BullMQ wired (spec §3, §11.2) — Tasks 3, 6, 8
- ✅ S3-compatible local store (MinIO standing in for R2) (spec §11.3) — Task 3
- ✅ env management + logger + ID generation (cross-cutting) — Task 4
- ✅ Hono HTTP base for `/v1/install` etc. (spec §3) — Task 7 (Plan 2 adds the actual endpoints)
- ✅ Worker process for OnboardingJob (spec §3) — Task 8 (Plan 3 adds the real handler)
- ✅ CI runs the same checks the dev runs locally — Task 10
- ❌ uWebSockets.js — deliberately deferred to Plan 7 (we're using `@hono/node-server` for now; switching the transport later is isolated to `apps/api/src/index.ts`)
- ❌ Brand KB schema (`brand_kb_chunks`), `coupons`, `override_alerts` — Phase 2 tables, not Phase 1 — out of scope here
- ❌ Adapter interface, LLM loop, voice — out of scope here (Plans 4–8)

**Placeholder scan:** No TBDs. Every code block is complete. No "similar to task N" — code is repeated where touched.

**Type consistency:** `MerchantStatus`, `AdapterType`, `SelectorSource` defined in their schema files and re-exported via `packages/db/src/schema/index.ts`. `OnboardingJobData` defined once in `packages/jobs/src/queues.ts` and re-exported via `packages/jobs/src/index.ts`. No mismatches.

---

## Acceptance for Plan 1

After Task 11, the following must all be true:

1. `docker compose ps` shows postgres + redis + minio healthy.
2. `pnpm db:migrate` runs cleanly; `\dt` lists 6 tables (`merchants`, `products`, `selector_cache`, `conversion_events`, `billing_ledger`, `metric_events`) + `__drizzle_migrations`.
3. `pnpm test` reports ~10 tests passing across all packages.
4. `pnpm lint` reports zero issues.
5. `pnpm typecheck` reports zero errors.
6. `pnpm build` produces dist outputs for `apps/api` and `apps/worker`.
7. `pnpm dev` boots both api + worker. `curl localhost:3000/health` → `{"ok":true}`.
8. CI on a pushed branch runs the full sequence and is green.
9. Tag `phase1-plan1-foundation-complete` exists in git.

When all 9 are green, Plan 1 is done. Then we write Plan 2 (Provisioning API + merchant lifecycle) and execute it on top of this foundation.
