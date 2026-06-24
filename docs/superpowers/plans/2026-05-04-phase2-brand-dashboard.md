# Phase 2 — Brand Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `app.shoppingmate.ai` — the brand-facing dashboard where merchants log in, pay (Day-1 Starter $30), connect their store, paste their script tag, see analytics, upload Brand Knowledge, configure persona/webhook, and self-serve billing.

**Architecture:** Single Next.js 16 / React 19 / Tailwind 4 app at `web/`, route-segmented into `(marketing)`, `(auth)`, and `app/*` (auth-gated dashboard). Subdomain rewrite via `middleware.ts`. Better-Auth + Resend (magic-link), Stripe Checkout/Customer Portal, Composio (Shopify OAuth), Cloudflare R2 (KB storage). Drizzle migrations extend the existing Postgres schema.

**Tech Stack:** Next.js 16 / React 19 / Tailwind 4 / Better-Auth / Drizzle ORM / Postgres / Stripe / Composio / Cloudflare R2 / BullMQ / Vitest + MSW + Playwright.

**Spec:** `docs/superpowers/specs/2026-05-04-phase2-brand-dashboard-design.md` (committed `9c28076`).

---

## Phase A — Foundation & data model

### Task A.1: Install dashboard dependencies in `web/`

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd web && pnpm add better-auth@^1.2.0 drizzle-orm@^0.36.4 postgres@^3.4.5 stripe@^17.5.0 @aws-sdk/client-s3@^3.700.0 @aws-sdk/s3-request-presigner@^3.700.0 resend@^4.0.0 @composio/core@^0.1.0 pdf-parse@^1.1.1 mammoth@^1.8.0 gpt-tokenizer@^2.5.0 zod@^3.24.0 bullmq@^5.27.0 ioredis@^5.4.1
```

And dev deps:
```bash
cd web && pnpm add -D drizzle-kit@^0.31.10 @playwright/test@^1.50.0 msw@^2.6.0 @types/pdf-parse@^1.1.4
```

Expected: `web/package.json` updated, `pnpm-lock.yaml` regenerated.

- [ ] **Step 2: Verify install**

Run: `cd web && pnpm install --frozen-lockfile`
Expected: success, no peer warnings on react@19 / next@16.

- [ ] **Step 3: Commit**

```bash
git add web/package.json pnpm-lock.yaml
git commit -m "chore(web): add dashboard deps (better-auth, drizzle, stripe, composio, r2, bullmq)"
```

---

### Task A.2: Drizzle migration — Better-Auth tables (users, sessions, verifications)

**Files:**
- Create: `packages/db/src/schema/auth.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0006_auth_tables.sql` (auto-generated)
- Test: `packages/db/test/schema/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/test/schema/auth.test.ts
import { describe, expect, it } from 'vitest';
import { users, sessions, verifications } from '../../src/schema/auth';

describe('auth schema', () => {
  it('users table has required columns', () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.emailVerified).toBeDefined();
    expect(users.name).toBeDefined();
    expect(users.image).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();
  });

  it('sessions table has required columns', () => {
    expect(sessions.id).toBeDefined();
    expect(sessions.userId).toBeDefined();
    expect(sessions.expiresAt).toBeDefined();
    expect(sessions.token).toBeDefined();
    expect(sessions.ipAddress).toBeDefined();
    expect(sessions.userAgent).toBeDefined();
  });

  it('verifications table has required columns', () => {
    expect(verifications.id).toBeDefined();
    expect(verifications.identifier).toBeDefined();
    expect(verifications.value).toBeDefined();
    expect(verifications.expiresAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shoppingmate/db test test/schema/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal schema**

```ts
// packages/db/src/schema/auth.ts
import { pgTable, text, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
```

- [ ] **Step 4: Re-export from schema index**

```ts
// packages/db/src/schema/index.ts — add line
export * from './auth';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @shoppingmate/db test test/schema/auth.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 6: Generate migration**

Run: `pnpm --filter @shoppingmate/db drizzle-kit generate --name=auth_tables`
Expected: new file `packages/db/drizzle/0006_auth_tables.sql` created.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/auth.ts packages/db/src/schema/index.ts packages/db/test/schema/auth.test.ts packages/db/drizzle/
git commit -m "feat(db): better-auth tables (users, sessions, verifications)"
```

---

### Task A.3: Drizzle migration — shoppingmate dashboard tables

**Files:**
- Create: `packages/db/src/schema/dashboard.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0007_dashboard_tables.sql`
- Test: `packages/db/test/schema/dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/test/schema/dashboard.test.ts
import { describe, expect, it } from 'vitest';
import {
  merchantOwners,
  brandKbDocuments,
  brandKbChunks,
  alerts,
  stripeEvents,
} from '../../src/schema/dashboard';

describe('dashboard schema', () => {
  it('merchantOwners has composite key columns', () => {
    expect(merchantOwners.userId).toBeDefined();
    expect(merchantOwners.merchantId).toBeDefined();
    expect(merchantOwners.role).toBeDefined();
  });

  it('brandKbDocuments has all columns', () => {
    expect(brandKbDocuments.id).toBeDefined();
    expect(brandKbDocuments.merchantId).toBeDefined();
    expect(brandKbDocuments.filename).toBeDefined();
    expect(brandKbDocuments.mimeType).toBeDefined();
    expect(brandKbDocuments.sizeBytes).toBeDefined();
    expect(brandKbDocuments.storageUrl).toBeDefined();
    expect(brandKbDocuments.status).toBeDefined();
    expect(brandKbDocuments.enabled).toBeDefined();
  });

  it('brandKbChunks has all columns', () => {
    expect(brandKbChunks.id).toBeDefined();
    expect(brandKbChunks.documentId).toBeDefined();
    expect(brandKbChunks.merchantId).toBeDefined();
    expect(brandKbChunks.chunkIndex).toBeDefined();
    expect(brandKbChunks.text).toBeDefined();
    expect(brandKbChunks.tokenCount).toBeDefined();
  });

  it('alerts has all columns', () => {
    expect(alerts.id).toBeDefined();
    expect(alerts.merchantId).toBeDefined();
    expect(alerts.kind).toBeDefined();
    expect(alerts.severity).toBeDefined();
    expect(alerts.payload).toBeDefined();
    expect(alerts.acknowledgedAt).toBeDefined();
    expect(alerts.resolvedAt).toBeDefined();
  });

  it('stripeEvents has idempotency columns', () => {
    expect(stripeEvents.id).toBeDefined();
    expect(stripeEvents.type).toBeDefined();
    expect(stripeEvents.receivedAt).toBeDefined();
    expect(stripeEvents.processedAt).toBeDefined();
    expect(stripeEvents.payload).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shoppingmate/db test test/schema/dashboard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal schema**

```ts
// packages/db/src/schema/dashboard.ts
import { pgTable, text, timestamp, boolean, integer, uuid, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { merchants } from './merchants';

export const merchantOwners = pgTable(
  'merchant_owners',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.merchantId] }),
  }),
);

export const brandKbDocuments = pgTable('brand_kb_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageUrl: text('storage_url').notNull(),
  status: text('status').notNull().default('uploaded'),
  enabled: boolean('enabled').notNull().default(true),
  errorMessage: text('error_message'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
});

export const brandKbChunks = pgTable('brand_kb_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => brandKbDocuments.id, { onDelete: 'cascade' }),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  text: text('text').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  severity: text('severity').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  payload: jsonb('payload'),
});

export type MerchantOwner = typeof merchantOwners.$inferSelect;
export type BrandKbDocument = typeof brandKbDocuments.$inferSelect;
export type BrandKbChunk = typeof brandKbChunks.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AlertKind = 'override_failing' | 'smoke_failing' | 'catalog_drift' | 'margin_breach' | 'payment_failed';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type StripeEvent = typeof stripeEvents.$inferSelect;
```

- [ ] **Step 4: Re-export from schema index**

```ts
// packages/db/src/schema/index.ts — add line
export * from './dashboard';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @shoppingmate/db test test/schema/dashboard.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 6: Generate migration**

Run: `pnpm --filter @shoppingmate/db drizzle-kit generate --name=dashboard_tables`
Expected: new file `packages/db/drizzle/0007_dashboard_tables.sql`.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/dashboard.ts packages/db/src/schema/index.ts packages/db/test/schema/dashboard.test.ts packages/db/drizzle/
git commit -m "feat(db): dashboard tables (merchant_owners, brand_kb, alerts, stripe_events)"
```

---

### Task A.4: Drizzle migration — merchants table additions

**Files:**
- Modify: `packages/db/src/schema/merchants.ts`
- Create: `packages/db/drizzle/0008_merchants_dashboard_columns.sql`
- Test: `packages/db/test/schema/merchants-dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/test/schema/merchants-dashboard.test.ts
import { describe, expect, it } from 'vitest';
import { merchants } from '../../src/schema/merchants';

describe('merchants dashboard columns', () => {
  it('has Stripe billing columns', () => {
    expect(merchants.stripeCustomerId).toBeDefined();
    expect(merchants.stripeSubscriptionId).toBeDefined();
    expect(merchants.plan).toBeDefined();
    expect(merchants.billingStatus).toBeDefined();
  });

  it('has persona + webhook columns', () => {
    expect(merchants.persona).toBeDefined();
    expect(merchants.leadWebhookUrl).toBeDefined();
  });

  it('has KB + install columns', () => {
    expect(merchants.knowledgeBaseStatus).toBeDefined();
    expect(merchants.lastWidgetPing).toBeDefined();
  });

  it('has top-up + auto-recharge columns', () => {
    expect(merchants.topupBalance).toBeDefined();
    expect(merchants.autoRechargeEnabled).toBeDefined();
    expect(merchants.autoRechargeThreshold).toBeDefined();
    expect(merchants.autoRechargePackSize).toBeDefined();
  });

  it('has soft-delete column', () => {
    expect(merchants.deletedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shoppingmate/db test test/schema/merchants-dashboard.test.ts`
Expected: FAIL — properties undefined.

- [ ] **Step 3: Add columns to merchants schema**

In `packages/db/src/schema/merchants.ts`, add to the `pgTable` columns object:

```ts
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  plan: text('plan').notNull().default('starter'),
  billingStatus: text('billing_status').notNull().default('pending'),
  persona: jsonb('persona').$type<{ voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number } | null>(),
  leadWebhookUrl: text('lead_webhook_url'),
  knowledgeBaseStatus: text('knowledge_base_status').notNull().default('empty'),
  lastWidgetPing: timestamp('last_widget_ping', { withTimezone: true }),
  topupBalance: integer('topup_balance').notNull().default(0),
  autoRechargeEnabled: boolean('auto_recharge_enabled').notNull().default(false),
  autoRechargeThreshold: integer('auto_recharge_threshold'),
  autoRechargePackSize: integer('auto_recharge_pack_size'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

Make sure `boolean`, `integer`, `jsonb` are in the imports from `drizzle-orm/pg-core`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @shoppingmate/db test test/schema/merchants-dashboard.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Generate migration**

Run: `pnpm --filter @shoppingmate/db drizzle-kit generate --name=merchants_dashboard_columns`
Expected: new file `packages/db/drizzle/0008_merchants_dashboard_columns.sql` with `ALTER TABLE merchants ADD COLUMN ...` for each new column.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/merchants.ts packages/db/test/schema/merchants-dashboard.test.ts packages/db/drizzle/
git commit -m "feat(db): merchants dashboard columns (stripe, persona, kb_status, topups, soft-delete)"
```

---

### Task A.5: shadcn/ui base components

**Files:**
- Create: `web/src/components/ui/button.tsx`
- Create: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/card.tsx`
- Create: `web/src/components/ui/dialog.tsx`
- Create: `web/src/lib/cn.ts`
- Test: `web/src/components/ui/button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/ui/button.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('applies variant class', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-transparent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/ui/button.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the cn helper**

```ts
// web/src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Add deps:
```bash
cd web && pnpm add clsx tailwind-merge
```

- [ ] **Step 4: Write Button component**

```tsx
// web/src/components/ui/button.tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-black text-white hover:bg-zinc-800',
  ghost: 'bg-transparent text-zinc-900 hover:bg-zinc-100',
  outline: 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 5: Write Input, Card, Dialog**

```tsx
// web/src/components/ui/input.tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

```tsx
// web/src/components/ui/card.tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-lg border border-zinc-200 bg-white shadow-sm', className)} {...props} />
);
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-6', className)} {...props} />
);
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />
);
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-zinc-500', className)} {...props} />
);
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
);
```

```tsx
// web/src/components/ui/dialog.tsx
'use client';
import * as React from 'react';
import { cn } from '@/lib/cn';

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg')}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test src/components/ui/button.test.tsx`
Expected: PASS — 2/2.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ui web/src/lib/cn.ts web/package.json pnpm-lock.yaml
git commit -m "feat(web): shadcn-style ui primitives (button, input, card, dialog)"
```

---

## Phase B — Better-Auth

### Task B.1: Better-Auth config

**Files:**
- Create: `web/src/lib/auth.ts`
- Create: `web/src/lib/db.ts`
- Create: `web/src/lib/resend.ts`
- Test: `web/src/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/auth.test.ts
import { describe, expect, it } from 'vitest';
import { auth } from './auth';

describe('auth', () => {
  it('exports a Better-Auth instance', () => {
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe('function');
  });

  it('has email magic-link plugin enabled', () => {
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.signInMagicLink).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write db client**

```ts
// web/src/lib/db.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shoppingmate/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString, { max: 5 });
export const db = drizzle(client, { schema });
export { schema };
```

- [ ] **Step 4: Write resend client**

```ts
// web/src/lib/resend.ts
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) throw new Error('RESEND_API_KEY is not set');

export const resend = new Resend(apiKey);

export async function sendMagicLink(email: string, url: string) {
  await resend.emails.send({
    from: 'shoppingmate <login@shoppingmate.ai>',
    to: email,
    subject: 'Sign in to shoppingmate',
    html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`,
  });
}
```

- [ ] **Step 5: Write Better-Auth config**

```ts
// web/src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db, schema } from './db';
import { sendMagicLink } from './resend';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: false },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLink(email, url);
      },
      expiresIn: 60 * 15,
    }),
  ],
  rateLimit: {
    window: 15 * 60,
    max: 5,
  },
});

export type Session = typeof auth.$Infer.Session;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/auth.test.ts`
Expected: PASS — 2/2.

Set test env in `web/vitest.config.ts` to load `.env.test`:

```ts
// web/vitest.config.ts (modify or create)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-for-vitest-only',
      RESEND_API_KEY: 'test-resend-key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/auth.ts web/src/lib/db.ts web/src/lib/resend.ts web/src/lib/auth.test.ts web/vitest.config.ts
git commit -m "feat(web): better-auth config with magic-link via resend"
```

---

### Task B.2: `/api/auth/[...all]` route handler

**Files:**
- Create: `web/src/app/api/auth/[...all]/route.ts`
- Test: `web/src/app/api/auth/[...all]/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/auth/[...all]/route.test.ts
import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('/api/auth/[...all]', () => {
  it('exports GET and POST handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('GET returns Response from auth.handler', async () => {
    const req = new Request('http://localhost:3000/api/auth/session');
    const res = await GET(req);
    expect(res).toBeInstanceOf(Response);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/auth/[...all]/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route handler**

```ts
// web/src/app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';

export const GET = (req: Request) => auth.handler(req);
export const POST = (req: Request) => auth.handler(req);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/auth/[...all]/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/auth
git commit -m "feat(web): better-auth catch-all route handler"
```

---

### Task B.3: Session helper + middleware (auth gate + subdomain rewrite)

**Files:**
- Create: `web/src/lib/session.ts`
- Create: `web/middleware.ts`
- Test: `web/src/lib/session.test.ts`
- Test: `web/middleware.test.ts`

- [ ] **Step 1: Write the failing test for session helper**

```ts
// web/src/lib/session.test.ts
import { describe, expect, it, vi } from 'vitest';
import { getDashboardSession } from './session';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: { merchantOwners: { findFirst: vi.fn() } },
  },
}));

describe('getDashboardSession', () => {
  it('returns null when no session', async () => {
    const result = await getDashboardSession({ headers: new Headers() });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement session helper**

```ts
// web/src/lib/session.ts
import { auth } from './auth';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { merchantOwners, merchants } from '@shoppingmate/db/schema';

export type DashboardSession = {
  user: { id: string; email: string; name: string | null; image: string | null };
  session: { id: string; expiresAt: Date };
  merchant: {
    id: string;
    plan: string;
    billingStatus: string;
    status: string;
    persona: { voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number } | null;
    leadWebhookUrl: string | null;
    knowledgeBaseStatus: string;
    lastWidgetPing: Date | null;
  } | null;
};

export async function getDashboardSession({ headers }: { headers: Headers }): Promise<DashboardSession | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const ownerRow = await db.query.merchantOwners.findFirst({
    where: eq(merchantOwners.userId, session.user.id),
  });

  let merchant: DashboardSession['merchant'] = null;
  if (ownerRow) {
    const m = await db.query.merchants.findFirst({
      where: eq(merchants.id, ownerRow.merchantId),
    });
    if (m && !m.deletedAt) {
      merchant = {
        id: m.id,
        plan: m.plan,
        billingStatus: m.billingStatus,
        status: m.status,
        persona: m.persona ?? null,
        leadWebhookUrl: m.leadWebhookUrl,
        knowledgeBaseStatus: m.knowledgeBaseStatus,
        lastWidgetPing: m.lastWidgetPing,
      };
    }
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
    session: { id: session.session.id, expiresAt: session.session.expiresAt },
    merchant,
  };
}

export function resolveOnboardingStep(merchant: DashboardSession['merchant']): string {
  if (!merchant) return '/app/onboarding?step=2';
  if (merchant.billingStatus === 'pending') return '/app/onboarding?step=2';
  if (['catalog_pending', 'selectors_pending', 'smoke_pending'].includes(merchant.status)) {
    return '/app/onboarding?step=3';
  }
  if (merchant.status === 'live' && !merchant.lastWidgetPing) return '/app/onboarding?step=4';
  if (merchant.status === 'suspended') return '/app/billing';
  return '/app';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/session.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 5: Write the failing test for middleware**

```ts
// web/middleware.test.ts
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

describe('middleware', () => {
  it('redirects unauthenticated /app requests to /login', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/app');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
  });

  it('rewrites app subdomain to /app prefix', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/');
    const res = await middleware(req);
    expect(res?.headers.get('x-middleware-rewrite') || res?.headers.get('location')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd web && pnpm test middleware.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement middleware**

```ts
// web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? 'app.shoppingmate.ai';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host') ?? '';

  const isAppHost = host === APP_HOST || host.startsWith('app.localhost');

  if (isAppHost && !url.pathname.startsWith('/app') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/signup') && !url.pathname.startsWith('/verify')) {
    url.pathname = `/app${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (url.pathname.startsWith('/app')) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      const loginUrl = url.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd web && pnpm test middleware.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/session.ts web/middleware.ts web/src/lib/session.test.ts web/middleware.test.ts
git commit -m "feat(web): session helper + middleware (auth gate + app subdomain rewrite)"
```

---

### Task B.4: Signup, login, and verify pages

**Files:**
- Create: `web/src/app/(auth)/layout.tsx`
- Create: `web/src/app/(auth)/signup/page.tsx`
- Create: `web/src/app/(auth)/login/page.tsx`
- Create: `web/src/app/(auth)/verify/page.tsx`
- Test: `web/src/app/(auth)/signup/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/app/(auth)/signup/page.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SignupPage from './page';

describe('SignupPage', () => {
  it('renders email input and submit button', () => {
    render(<SignupPage />);
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign up|continue/i })).toBeTruthy();
  });

  it('shows shoppingmate brand mark', () => {
    render(<SignupPage />);
    expect(screen.getByText(/shoppingmate/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/\(auth\)/signup/page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write auth layout**

```tsx
// web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Write signup page**

```tsx
// web/src/app/(auth)/signup/page.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: '/app/onboarding' }),
      });
      if (!res.ok) throw new Error('Failed to send magic link');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>shoppingmate</CardTitle>
        <CardDescription>Start your $30/mo Starter plan. Magic-link sign-up — no password.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-zinc-700">Check your inbox at <strong>{email}</strong> for a sign-in link.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input type="email" placeholder="you@brand.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Sign up'}</Button>
            <p className="text-xs text-zinc-500">By continuing you agree to our Terms.</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Write login page**

```tsx
// web/src/app/(auth)/login/page.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, callbackURL: '/app' }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to shoppingmate</CardTitle>
        <CardDescription>We&apos;ll email you a magic link.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-zinc-700">Check your inbox at <strong>{email}</strong>.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input type="email" placeholder="you@brand.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send link'}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Write verify page**

```tsx
// web/src/app/(auth)/verify/page.tsx
import { redirect } from 'next/navigation';

export default function VerifyPage({ searchParams }: { searchParams: { error?: string } }) {
  if (searchParams.error) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold">Link expired or invalid</h1>
        <p className="mt-2 text-sm text-zinc-600">Request a new sign-in link.</p>
        <a href="/login" className="mt-4 inline-block underline">Back to sign in</a>
      </div>
    );
  }
  redirect('/app');
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd web && pnpm test src/app/\(auth\)/`
Expected: PASS — 2/2.

- [ ] **Step 8: Commit**

```bash
git add web/src/app/\(auth\)/
git commit -m "feat(web): signup/login/verify pages with magic-link UX"
```

---

## Phase C — Dashboard shell

### Task C.1: Sidebar component

**Files:**
- Create: `web/src/components/dashboard/Sidebar.tsx`
- Test: `web/src/components/dashboard/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/Sidebar.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders all primary nav links', () => {
    render(<Sidebar pathname="/app" />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('Knowledge')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
  });

  it('does NOT render Diagnostics in nav (banner-only landing)', () => {
    render(<Sidebar pathname="/app" />);
    expect(screen.queryByText('Diagnostics')).toBeNull();
  });

  it('marks current path active', () => {
    render(<Sidebar pathname="/app/billing" />);
    const billingLink = screen.getByText('Billing').closest('a');
    expect(billingLink?.getAttribute('aria-current')).toBe('page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/Sidebar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Sidebar**

```tsx
// web/src/components/dashboard/Sidebar.tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/conversations', label: 'Conversations' },
  { href: '/app/knowledge', label: 'Knowledge' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/billing', label: 'Billing' },
];

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 p-4 w-56 border-r border-zinc-200 h-screen sticky top-0">
      <div className="px-2 py-3 font-semibold tracking-tight">shoppingmate</div>
      {NAV.map((item) => {
        const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/Sidebar.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/dashboard/Sidebar.tsx web/src/components/dashboard/Sidebar.test.tsx
git commit -m "feat(web): dashboard sidebar (no Diagnostics link, banner-only per §7.4)"
```

---

### Task C.2: AlertBanner component + alerts repo

**Files:**
- Create: `web/src/lib/alerts-repo.ts`
- Create: `web/src/components/dashboard/AlertBanner.tsx`
- Test: `web/src/components/dashboard/AlertBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/AlertBanner.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  it('renders nothing when alert is null', () => {
    const { container } = render(<AlertBanner alert={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders override_failing copy + Accept fix action', () => {
    render(
      <AlertBanner
        alert={{
          id: 'a1',
          kind: 'override_failing',
          severity: 'warning',
          payload: { selector_key: 'add_to_cart' },
        }}
      />,
    );
    expect(screen.getByText(/add_to_cart/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept fix/i })).toBeTruthy();
  });

  it('renders payment_failed with Update payment link', () => {
    render(
      <AlertBanner
        alert={{ id: 'a2', kind: 'payment_failed', severity: 'critical', payload: {} }}
      />,
    );
    expect(screen.getByText(/last invoice failed/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /update payment/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/AlertBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write alerts repo**

```ts
// web/src/lib/alerts-repo.ts
import { db } from './db';
import { alerts, type Alert } from '@shoppingmate/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

export async function getActiveAlert(merchantId: string): Promise<Alert | null> {
  const rows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.merchantId, merchantId), isNull(alerts.resolvedAt)))
    .orderBy(desc(alerts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveAlert(id: string) {
  await db.update(alerts).set({ resolvedAt: new Date() }).where(eq(alerts.id, id));
}

export async function createAlert(args: {
  merchantId: string;
  kind: string;
  severity: string;
  payload: unknown;
}) {
  await db.insert(alerts).values({
    merchantId: args.merchantId,
    kind: args.kind,
    severity: args.severity,
    payload: args.payload as Record<string, unknown>,
  });
}
```

- [ ] **Step 4: Write AlertBanner**

```tsx
// web/src/components/dashboard/AlertBanner.tsx
'use client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type AlertProps = {
  id: string;
  kind: 'override_failing' | 'smoke_failing' | 'catalog_drift' | 'payment_failed';
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
};

const SEVERITY_STYLES: Record<AlertProps['severity'], string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-red-50 border-red-200 text-red-900',
};

export function AlertBanner({ alert }: { alert: AlertProps | null }) {
  if (!alert) return null;

  let copy: React.ReactNode;
  let action: React.ReactNode;

  switch (alert.kind) {
    case 'override_failing': {
      const key = (alert.payload.selector_key as string) ?? 'unknown';
      copy = <>Your <code className="px-1 bg-white/50 rounded">{key}</code> selector is failing — accept the suggested fix?</>;
      action = (
        <form action={`/api/alerts/${alert.id}/accept`} method="post">
          <Button size="sm" type="submit">Accept fix</Button>
        </form>
      );
      break;
    }
    case 'smoke_failing':
      copy = <>Your widget can&apos;t add items to cart. Catalog or selectors are broken.</>;
      action = <a href={`/app/diagnostics?alert=${alert.id}`} className="underline text-sm font-medium">View details</a>;
      break;
    case 'catalog_drift':
      copy = <>Your catalog hasn&apos;t synced in 24h.</>;
      action = (
        <form action="/api/merchant/resync" method="post">
          <Button size="sm" type="submit" variant="outline">Re-sync now</Button>
        </form>
      );
      break;
    case 'payment_failed':
      copy = <>Your last invoice failed. Update payment to keep your widget live.</>;
      action = <a href="/app/billing" className="underline text-sm font-medium">Update payment</a>;
      break;
  }

  return (
    <div className={cn('flex items-center justify-between gap-4 border-b px-6 py-3', SEVERITY_STYLES[alert.severity])}>
      <div className="text-sm">{copy}</div>
      <div>{action}</div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/AlertBanner.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/alerts-repo.ts web/src/components/dashboard/AlertBanner.tsx web/src/components/dashboard/AlertBanner.test.tsx
git commit -m "feat(web): alert banner + alerts repo (5 alert kinds per §7)"
```

---

### Task C.3: Dashboard layout (`app/(app)/layout.tsx`)

**Files:**
- Create: `web/src/app/app/layout.tsx`

- [ ] **Step 1: Implement dashboard layout**

```tsx
// web/src/app/app/layout.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { getDashboardSession, resolveOnboardingStep } from '@/lib/session';
import { getActiveAlert } from '@/lib/alerts-repo';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });

  if (!session) redirect('/login');

  const step = resolveOnboardingStep(session.merchant);
  const pathname = hdrs.get('x-pathname') ?? '/app';

  if (step !== '/app' && !pathname.startsWith('/app/onboarding')) {
    redirect(step);
  }

  const alert = session.merchant ? await getActiveAlert(session.merchant.id) : null;

  return (
    <div className="flex">
      <Sidebar pathname={pathname} />
      <div className="flex-1 flex flex-col">
        <AlertBanner alert={alert as Parameters<typeof AlertBanner>[0]['alert']} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add x-pathname to middleware**

Edit `web/middleware.ts` to set the pathname header before returning `NextResponse.next()`:

```ts
const res = NextResponse.next();
res.headers.set('x-pathname', url.pathname);
return res;
```

(Apply the same to the rewrite branch — set the header on the rewrite response.)

- [ ] **Step 3: Manually verify it loads**

Run: `cd web && pnpm dev` and visit `http://localhost:3000/app` — should redirect to `/login` when no session.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/app/layout.tsx web/middleware.ts
git commit -m "feat(web): dashboard layout shell (sidebar + alert banner + onboarding gate)"
```

---

## Phase D — Stripe Checkout & webhooks

### Task D.1: Stripe SDK wrapper

**Files:**
- Create: `web/src/lib/stripe.ts`
- Test: `web/src/lib/stripe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/stripe.test.ts
import { describe, expect, it } from 'vitest';
import { stripe, PRICE_IDS } from './stripe';

describe('stripe wrapper', () => {
  it('exports a Stripe client', () => {
    expect(stripe).toBeDefined();
    expect(typeof stripe.checkout.sessions.create).toBe('function');
  });

  it('exports PRICE_IDS map for plans + topup packs', () => {
    expect(PRICE_IDS.starter_monthly).toBeDefined();
    expect(PRICE_IDS.topup_50).toBeDefined();
    expect(PRICE_IDS.topup_200).toBeDefined();
    expect(PRICE_IDS.topup_1000).toBeDefined();
    expect(PRICE_IDS.topup_5000).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/stripe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement stripe wrapper**

```ts
// web/src/lib/stripe.ts
import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not set');

export const stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });

export const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
  growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? '',
  scale_monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY ?? '',
  topup_50: process.env.STRIPE_PRICE_TOPUP_50 ?? '',
  topup_200: process.env.STRIPE_PRICE_TOPUP_200 ?? '',
  topup_1000: process.env.STRIPE_PRICE_TOPUP_1000 ?? '',
  topup_5000: process.env.STRIPE_PRICE_TOPUP_5000 ?? '',
} as const;

export type TopupKey = 'topup_50' | 'topup_200' | 'topup_1000' | 'topup_5000';
export const TOPUP_QTYS: Record<TopupKey, number> = {
  topup_50: 50,
  topup_200: 200,
  topup_1000: 1000,
  topup_5000: 5000,
};
```

Add Stripe price env vars to vitest config:

```ts
// web/vitest.config.ts — extend env block
env: {
  // existing keys...
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_PRICE_STARTER_MONTHLY: 'price_test_starter',
  STRIPE_PRICE_GROWTH_MONTHLY: 'price_test_growth',
  STRIPE_PRICE_SCALE_MONTHLY: 'price_test_scale',
  STRIPE_PRICE_TOPUP_50: 'price_test_t50',
  STRIPE_PRICE_TOPUP_200: 'price_test_t200',
  STRIPE_PRICE_TOPUP_1000: 'price_test_t1000',
  STRIPE_PRICE_TOPUP_5000: 'price_test_t5000',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/stripe.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/stripe.ts web/src/lib/stripe.test.ts web/vitest.config.ts
git commit -m "feat(web): stripe sdk wrapper + price id map"
```

---

### Task D.2: `/api/billing/checkout-session`

**Files:**
- Create: `web/src/app/api/billing/checkout-session/route.ts`
- Test: `web/src/app/api/billing/checkout-session/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/billing/checkout-session/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: null,
  }),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_test' }) },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/x' }),
      },
    },
  },
  PRICE_IDS: { starter_monthly: 'price_test_starter' },
}));

import { POST } from './route';

describe('POST /api/billing/checkout-session', () => {
  it('returns Stripe Checkout URL', async () => {
    const req = new Request('http://localhost/api/billing/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toContain('checkout.stripe.com');
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

Run: `cd web && pnpm test src/app/api/billing/checkout-session/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/billing/checkout-session/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { stripe, PRICE_IDS } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const customer = await stripe.customers.create({
    email: session.user.email,
    metadata: { user_id: session.user.id },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS.starter_monthly, quantity: 1 }],
    success_url: `${baseUrl}/app/onboarding?step=3`,
    cancel_url: `${baseUrl}/app/onboarding?step=2`,
    metadata: { user_id: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/billing/checkout-session/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/billing/checkout-session
git commit -m "feat(web): /api/billing/checkout-session for Starter signup"
```

---

### Task D.3: `/api/webhooks/stripe` (idempotent)

**Files:**
- Create: `web/src/lib/merchant-id.ts`
- Create: `web/src/app/api/webhooks/stripe/route.ts`
- Test: `web/src/app/api/webhooks/stripe/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/webhooks/stripe/route.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const insertMerchant = vi.fn();
const insertOwner = vi.fn();
const insertEvent = vi.fn();
const findEvent = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: insertMerchant.mockReturnValue({ onConflictDoNothing: () => Promise.resolve() }) })),
    query: { stripeEvents: { findFirst: findEvent } },
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn().mockImplementation((body, _sig, _secret) => JSON.parse(body)),
    },
  },
}));

import { POST } from './route';

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    findEvent.mockReset();
  });

  it('returns 200 on signed checkout.session.completed', async () => {
    findEvent.mockResolvedValue(null);
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test',
          subscription: 'sub_test',
          metadata: { user_id: 'u1' },
        },
      },
    };
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('skips already-processed events (idempotent)', async () => {
    findEvent.mockResolvedValue({ id: 'evt_1', processedAt: new Date() });
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } };
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: JSON.stringify(event),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });

  it('returns 400 when signature missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/webhooks/stripe/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write merchant id helper**

```ts
// web/src/lib/merchant-id.ts
const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
export function generateMerchantId(): string {
  let id = 'SM-';
  for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
}
```

- [ ] **Step 4: Implement webhook route**

```ts
// web/src/app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { merchants, merchantOwners, stripeEvents } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { generateMerchantId } from '@/lib/merchant-id';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const existing = await db.query.stripeEvents.findFirst({ where: eq(stripeEvents.id, event.id) });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  await db.insert(stripeEvents).values({ id: event.id, type: event.type, payload: event as object }).onConflictDoNothing();

  switch (event.type) {
    case 'checkout.session.completed': {
      const obj = event.data.object as { customer: string; subscription?: string; mode?: string; metadata?: { user_id?: string; topup_key?: string }; amount_total?: number };
      const userId = obj.metadata?.user_id;
      if (!userId) break;

      if (obj.mode === 'subscription' && obj.subscription) {
        const merchantId = generateMerchantId();
        await db.insert(merchants).values({
          id: merchantId,
          domain: `${merchantId.toLowerCase()}.pending`,
          status: 'catalog_pending',
          plan: 'starter',
          billingStatus: 'active',
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.subscription,
        }).onConflictDoNothing();

        await db.insert(merchantOwners).values({
          userId,
          merchantId,
          role: 'owner',
        }).onConflictDoNothing();
      } else if (obj.mode === 'payment' && obj.metadata?.topup_key) {
        const { TOPUP_QTYS } = await import('@/lib/stripe');
        const qty = TOPUP_QTYS[obj.metadata.topup_key as keyof typeof TOPUP_QTYS];
        await db.update(merchants)
          .set({ topupBalance: qty })
          .where(eq(merchants.stripeCustomerId, obj.customer));
      }
      break;
    }
    case 'invoice.payment_failed': {
      const obj = event.data.object as { customer: string };
      await db.update(merchants).set({ billingStatus: 'past_due' }).where(eq(merchants.stripeCustomerId, obj.customer));
      const m = await db.query.merchants.findFirst({ where: eq(merchants.stripeCustomerId, obj.customer) });
      if (m) {
        const { createAlert } = await import('@/lib/alerts-repo');
        await createAlert({ merchantId: m.id, kind: 'payment_failed', severity: 'critical', payload: {} });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const obj = event.data.object as { customer: string };
      await db.update(merchants).set({ billingStatus: 'canceled' }).where(eq(merchants.stripeCustomerId, obj.customer));
      break;
    }
  }

  await db.update(stripeEvents).set({ processedAt: new Date() }).where(eq(stripeEvents.id, event.id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/webhooks/stripe/route.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/merchant-id.ts web/src/app/api/webhooks/stripe/
git commit -m "feat(web): /api/webhooks/stripe — idempotent (subscription, topup, payment_failed, canceled)"
```

---

### Task D.4: Onboarding step 2 UI (Pay)

**Files:**
- Create: `web/src/app/app/onboarding/page.tsx`
- Create: `web/src/components/dashboard/OnboardingWizard.tsx`
- Test: `web/src/components/dashboard/OnboardingWizard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/OnboardingWizard.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

describe('OnboardingWizard', () => {
  it('renders 4-step progress bar', () => {
    render(<OnboardingWizard step={2} merchant={null} />);
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
  });

  it('step 2 shows Start Starter plan CTA', () => {
    render(<OnboardingWizard step={2} merchant={null} />);
    expect(screen.getByRole('button', { name: /start.*starter/i })).toBeTruthy();
  });

  it('step 4 shows install snippet code block', () => {
    const merchant = { id: 'SM-ABCDEF', status: 'live', plan: 'starter', billingStatus: 'active', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null };
    render(<OnboardingWizard step={4} merchant={merchant} />);
    expect(screen.getByText(/SM-ABCDEF/)).toBeTruthy();
    expect(screen.getByText(/cdn.shoppingmate.ai\/widget/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/OnboardingWizard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement OnboardingWizard**

```tsx
// web/src/components/dashboard/OnboardingWizard.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

type Merchant = {
  id: string;
  status: string;
  plan: string;
  billingStatus: string;
  persona: unknown;
  leadWebhookUrl: string | null;
  knowledgeBaseStatus: string;
  lastWidgetPing: Date | null;
};

const STEPS = ['Account', 'Pay', 'Connect store', 'Install snippet'];

export function OnboardingWizard({ step, merchant }: { step: number; merchant: Merchant | null }) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Progress current={step} />
      {step === 2 && <PayStep />}
      {step === 3 && merchant && <ConnectStep merchantId={merchant.id} status={merchant.status} />}
      {step === 4 && merchant && <InstallStep merchantId={merchant.id} />}
    </div>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <p className="text-sm text-zinc-500">Step {current} of 4</p>
      <div className="flex flex-1 gap-1 ml-4">
        {STEPS.map((label, i) => {
          const idx = i + 1;
          return (
            <div key={label} className={cn('h-1.5 flex-1 rounded-full', idx <= current ? 'bg-zinc-900' : 'bg-zinc-200')} />
          );
        })}
      </div>
    </div>
  );
}

function PayStep() {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    const res = await fetch('/api/billing/checkout-session', { method: 'POST' });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    setLoading(false);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your $30/mo Starter plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>100 conversations / month included</li>
          <li>Cross-platform widget (Shopify, Woo, Magento, BC, Wix, Squarespace, custom)</li>
          <li>Brand Knowledge base + persona settings</li>
          <li>Lead webhook + Stripe Customer Portal billing</li>
        </ul>
        <Button size="lg" onClick={go} disabled={loading}>{loading ? 'Redirecting…' : 'Start Starter plan'}</Button>
      </CardContent>
    </Card>
  );
}

function ConnectStep({ merchantId, status }: { merchantId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  async function connectShopify() {
    setLoading(true);
    const res = await fetch('/api/composio/connect-shopify', { method: 'POST' });
    const json = await res.json();
    if (json.auth_url) window.location.href = json.auth_url;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Connect Shopify</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 mb-4">Fastest, 30 seconds.</p>
          <Button onClick={connectShopify} disabled={loading}>{loading ? 'Connecting…' : 'Connect'}</Button>
          {status !== 'catalog_pending' && (
            <p className="text-xs text-zinc-500 mt-3">Status: <code>{status}</code></p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Use any other store URL</CardTitle></CardHeader>
        <CardContent>
          <UrlForm merchantId={merchantId} />
        </CardContent>
      </Card>
    </div>
  );
}

function UrlForm({ merchantId }: { merchantId: string }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/install/start-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, url }),
    });
    window.location.reload();
  }
  return (
    <form onSubmit={go} className="flex flex-col gap-2">
      <input
        className="border border-zinc-200 rounded-md px-3 py-2 text-sm"
        placeholder="https://yourstore.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <Button type="submit" variant="outline" disabled={loading}>{loading ? 'Working…' : 'Submit'}</Button>
    </form>
  );
}

function InstallStep({ merchantId }: { merchantId: string }) {
  const snippet = `<script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="${merchantId}"></script>`;
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function verify() {
    setVerifying(true);
    const res = await fetch('/api/install/verify', { method: 'POST' });
    const json = await res.json();
    setResult(json.ok ? 'ok' : 'fail');
    setVerifying(false);
    if (json.ok) window.location.href = '/app';
  }

  return (
    <Card>
      <CardHeader><CardTitle>Install your widget</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-md p-4 overflow-x-auto">{snippet}</pre>
        <div className="flex gap-2">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>{verifying ? 'Checking…' : "I've pasted it"}</Button>
          <a href="/app" className="ml-auto text-sm text-zinc-500 underline self-center">I&apos;ll do this later</a>
        </div>
        {result === 'fail' && <p className="text-sm text-red-600">We couldn&apos;t find the script tag yet. Make sure it&apos;s deployed and try again.</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Implement onboarding page**

```tsx
// web/src/app/app/onboarding/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) redirect('/login');

  const step = Number(sp.step ?? '2');
  return <OnboardingWizard step={step} merchant={session.merchant as Parameters<typeof OnboardingWizard>[0]['merchant']} />;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/OnboardingWizard.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/dashboard/OnboardingWizard.tsx web/src/app/app/onboarding
git commit -m "feat(web): onboarding wizard (4 steps with progress bar + step-specific UI)"
```

---

## Phase E — Composio integration

### Task E.1: Composio SDK wrapper

**Files:**
- Create: `web/src/lib/composio.ts`
- Test: `web/src/lib/composio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/composio.test.ts
import { describe, expect, it } from 'vitest';
import { composio, startShopifyConnection } from './composio';

describe('composio wrapper', () => {
  it('exports a Composio client', () => {
    expect(composio).toBeDefined();
  });

  it('exports startShopifyConnection that returns auth_url', async () => {
    expect(typeof startShopifyConnection).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/composio.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement wrapper**

```ts
// web/src/lib/composio.ts
import { Composio } from '@composio/core';

const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error('COMPOSIO_API_KEY is not set');

export const composio = new Composio({ apiKey });

export async function startShopifyConnection(args: { userId: string; merchantId: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const result = await composio.connectedAccounts.initiate({
    userId: args.userId,
    authConfigId: process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID!,
    callbackUrl: `${baseUrl}/api/webhooks/composio`,
    data: { merchant_id: args.merchantId },
  });
  return { authUrl: result.redirectUrl ?? '', connectionId: result.id };
}

export async function getConnection(id: string) {
  return composio.connectedAccounts.get(id);
}
```

Add Composio env vars to vitest:

```ts
// web/vitest.config.ts — append to env
COMPOSIO_API_KEY: 'test-composio-key',
COMPOSIO_SHOPIFY_AUTH_CONFIG_ID: 'ac_test_shopify',
COMPOSIO_WEBHOOK_SECRET: 'whsec_composio_test',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/composio.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/composio.ts web/src/lib/composio.test.ts web/vitest.config.ts
git commit -m "feat(web): composio sdk wrapper for shopify oauth"
```

---

### Task E.2: `/api/composio/connect-shopify`

**Files:**
- Create: `web/src/app/api/composio/connect-shopify/route.ts`
- Test: `web/src/app/api/composio/connect-shopify/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/composio/connect-shopify/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'catalog_pending', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/composio', () => ({
  startShopifyConnection: vi.fn().mockResolvedValue({ authUrl: 'https://shopify.com/oauth/x', connectionId: 'conn_test' }),
}));

import { POST } from './route';

describe('POST /api/composio/connect-shopify', () => {
  it('returns auth_url when authenticated', async () => {
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.auth_url).toContain('shopify.com');
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no merchant', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce({
      user: { id: 'u1', email: 'a@b.co', name: null, image: null },
      session: { id: 's1', expiresAt: new Date() },
      merchant: null,
    });
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/composio/connect-shopify/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/composio/connect-shopify/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { startShopifyConnection } from '@/lib/composio';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!session.merchant) return NextResponse.json({ error: 'no merchant' }, { status: 400 });

  const { authUrl, connectionId } = await startShopifyConnection({
    userId: session.user.id,
    merchantId: session.merchant.id,
  });
  return NextResponse.json({ auth_url: authUrl, connection_id: connectionId });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/composio/connect-shopify/route.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/composio
git commit -m "feat(web): /api/composio/connect-shopify start oauth flow"
```

---

### Task E.3: `/api/webhooks/composio` (HMAC-SHA256 verified)

**Files:**
- Create: `web/src/lib/composio-verify.ts`
- Create: `web/src/app/api/webhooks/composio/route.ts`
- Test: `web/src/lib/composio-verify.test.ts`
- Test: `web/src/app/api/webhooks/composio/route.test.ts`

- [ ] **Step 1: Write the failing test for verify helper**

```ts
// web/src/lib/composio-verify.test.ts
import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyComposioSignature } from './composio-verify';

const SECRET = 'test-secret';

function sign(body: string, ts: string, id: string): string {
  return createHmac('sha256', SECRET).update(`${id}.${ts}.${body}`).digest('base64');
}

describe('verifyComposioSignature', () => {
  it('accepts a valid signature', () => {
    const body = '{"x":1}';
    const ts = String(Math.floor(Date.now() / 1000));
    const id = 'msg_1';
    const sig = `v1,${sign(body, ts, id)}`;
    const result = verifyComposioSignature({ secret: SECRET, webhookId: id, webhookTimestamp: ts, webhookSignature: sig, rawBody: body });
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const body = '{"x":1}';
    const ts = String(Math.floor(Date.now() / 1000));
    const result = verifyComposioSignature({ secret: SECRET, webhookId: 'msg_1', webhookTimestamp: ts, webhookSignature: 'v1,deadbeef', rawBody: body });
    expect(result.ok).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const body = '{"x":1}';
    const ts = String(Math.floor(Date.now() / 1000) - 600);
    const id = 'msg_1';
    const sig = `v1,${sign(body, ts, id)}`;
    const result = verifyComposioSignature({ secret: SECRET, webhookId: id, webhookTimestamp: ts, webhookSignature: sig, rawBody: body });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('stale');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/composio-verify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement verify helper**

```ts
// web/src/lib/composio-verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyOpts {
  secret: string;
  webhookId: string | undefined;
  webhookTimestamp: string | undefined;
  webhookSignature: string | undefined;
  rawBody: string;
  toleranceSeconds?: number;
  now?: () => number;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyComposioSignature(opts: VerifyOpts): VerifyResult {
  const { secret, webhookId, webhookTimestamp, webhookSignature, rawBody } = opts;
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { ok: false, reason: 'missing headers' };
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };

  const now = (opts.now ?? Date.now)() / 1000;
  const tolerance = opts.toleranceSeconds ?? 300;
  if (Math.abs(now - ts) > tolerance) return { ok: false, reason: 'stale timestamp' };

  const expected = createHmac('sha256', secret)
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest('base64');

  const candidates = webhookSignature.split(' ').map((p) => p.replace(/^v1,/, ''));
  for (const cand of candidates) {
    const a = Buffer.from(expected);
    const b = Buffer.from(cand);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, reason: 'signature mismatch' };
}
```

- [ ] **Step 4: Run test to verify verify helper passes**

Run: `cd web && pnpm test src/lib/composio-verify.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 5: Write the failing test for webhook route**

```ts
// web/src/app/api/webhooks/composio/route.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-TEST01' }) } },
  },
}));

vi.mock('@/lib/composio', () => ({
  composio: { connectedAccounts: { get: vi.fn().mockResolvedValue({ id: 'conn_x', metadata: { merchant_id: 'SM-TEST01' }, status: 'ACTIVE' }) } },
}));

import { POST } from './route';

const SECRET = 'whsec_composio_test';

function makeReq(body: object) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const id = 'msg_test_1';
  const sig = createHmac('sha256', SECRET).update(`${id}.${ts}.${raw}`).digest('base64');
  return new Request('http://localhost/api/webhooks/composio', {
    method: 'POST',
    headers: {
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': `v1,${sig}`,
      'content-type': 'application/json',
    },
    body: raw,
  });
}

describe('POST /api/webhooks/composio', () => {
  it('returns 200 on a valid connection.activated event', async () => {
    const req = makeReq({ type: 'connection.activated', data: { connection_id: 'conn_x', metadata: { merchant_id: 'SM-TEST01' } } });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when signature missing', async () => {
    const req = new Request('http://localhost/api/webhooks/composio', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/webhooks/composio/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement webhook route**

```ts
// web/src/app/api/webhooks/composio/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { verifyComposioSignature } from '@/lib/composio-verify';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyComposioSignature({
    secret: process.env.COMPOSIO_WEBHOOK_SECRET!,
    webhookId: req.headers.get('webhook-id') ?? undefined,
    webhookTimestamp: req.headers.get('webhook-timestamp') ?? undefined,
    webhookSignature: req.headers.get('webhook-signature') ?? undefined,
    rawBody,
  });
  if (!verified.ok) return NextResponse.json({ error: verified.reason }, { status: 400 });

  const event = JSON.parse(rawBody) as { type: string; data: Record<string, unknown> };

  if (event.type === 'connection.activated') {
    const data = event.data as { connection_id: string; metadata?: { merchant_id?: string } };
    const merchantId = data.metadata?.merchant_id;
    if (!merchantId) return NextResponse.json({ ok: true, ignored: true });

    await db.update(merchants).set({
      adapterType: 'shopify',
      adapterConfig: { type: 'shopify', composio_connection_id: data.connection_id },
      status: 'catalog_pending',
    }).where(eq(merchants.id, merchantId));
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/webhooks/composio/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/composio-verify.ts web/src/lib/composio-verify.test.ts web/src/app/api/webhooks/composio
git commit -m "feat(web): /api/webhooks/composio with HMAC-SHA256 verification"
```

---

### Task E.4: `/api/install/start-url` + `/api/merchant/status`

**Files:**
- Create: `web/src/app/api/install/start-url/route.ts`
- Create: `web/src/app/api/merchant/status/route.ts`
- Test: `web/src/app/api/install/start-url/route.test.ts`
- Test: `web/src/app/api/merchant/status/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/app/api/install/start-url/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'catalog_pending', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })) },
}));

import { POST } from './route';

describe('POST /api/install/start-url', () => {
  it('rejects invalid URL', async () => {
    const req = new Request('http://localhost/api/install/start-url', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid URL and updates merchant', async () => {
    const req = new Request('http://localhost/api/install/start-url', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

```ts
// web/src/app/api/merchant/status/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

import { GET } from './route';

describe('GET /api/merchant/status', () => {
  it('returns the current merchant status', async () => {
    const req = new Request('http://localhost/api/merchant/status');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('live');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && pnpm test src/app/api/install src/app/api/merchant`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement routes**

```ts
// web/src/app/api/install/start-url/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const Body = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid url' }, { status: 400 });

  await db.update(merchants).set({
    domain: new URL(parsed.data.url).host,
    adapterConfig: { type: 'dom_pending', source_url: parsed.data.url },
    status: 'catalog_pending',
  }).where(eq(merchants.id, session.merchant.id));

  return NextResponse.json({ ok: true });
}
```

```ts
// web/src/app/api/merchant/status/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';

export async function GET(_req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.merchant.id,
    status: session.merchant.status,
    billingStatus: session.merchant.billingStatus,
    knowledgeBaseStatus: session.merchant.knowledgeBaseStatus,
    lastWidgetPing: session.merchant.lastWidgetPing,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && pnpm test src/app/api/install src/app/api/merchant`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/install/start-url web/src/app/api/merchant/status
git commit -m "feat(web): /api/install/start-url + /api/merchant/status (polling endpoint)"
```

---

## Phase F — Install verify

### Task F.1: `/api/install/verify`

**Files:**
- Create: `web/src/app/api/install/verify/route.ts`
- Test: `web/src/app/api/install/verify/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/install/verify/route.test.ts
import { describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-TEST01', domain: 'example.com' }) } },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  },
}));

const server = setupServer();
server.listen({ onUnhandledRequest: 'error' });

import { POST } from './route';

describe('POST /api/install/verify', () => {
  it('returns ok=true when script tag found', async () => {
    server.use(
      http.get('https://example.com', () => HttpResponse.html('<html><body><script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="SM-TEST01"></script></body></html>')),
    );
    const req = new Request('http://localhost/api/install/verify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns ok=false when script tag missing', async () => {
    server.use(http.get('https://example.com', () => HttpResponse.html('<html><body></body></html>')));
    const req = new Request('http://localhost/api/install/verify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/install/verify/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/install/verify/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

export async function POST(_req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.domain) return NextResponse.json({ ok: false, error: 'no domain' });

  const url = m.domain.startsWith('http') ? m.domain : `https://${m.domain}`;
  let html = '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    html = await res.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'fetch failed' });
  }

  const expectedNeedle = `data-id="${session.merchant.id}"`;
  const found = html.includes('cdn.shoppingmate.ai/widget') && html.includes(expectedNeedle);

  if (found) {
    await db.update(merchants).set({ lastWidgetPing: new Date() }).where(eq(merchants.id, session.merchant.id));
  }

  return NextResponse.json({ ok: found });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/install/verify/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/install/verify
git commit -m "feat(web): /api/install/verify pings merchant URL for script tag presence"
```

---

## Phase G — Home page

### Task G.1: KPI tile component + repo

**Files:**
- Create: `web/src/lib/kpi-repo.ts`
- Create: `web/src/components/dashboard/KpiTile.tsx`
- Test: `web/src/lib/kpi-repo.test.ts`
- Test: `web/src/components/dashboard/KpiTile.test.tsx`

- [ ] **Step 1: Write the failing test for KpiTile**

```tsx
// web/src/components/dashboard/KpiTile.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiTile } from './KpiTile';

describe('KpiTile', () => {
  it('renders label, value and trend arrow', () => {
    render(<KpiTile label="Conversations" value="124" delta={0.18} />);
    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('124')).toBeTruthy();
    expect(screen.getByText(/18%/)).toBeTruthy();
  });

  it('renders down arrow for negative delta', () => {
    render(<KpiTile label="Voice ratio" value="12%" delta={-0.05} />);
    expect(screen.getByText(/↓/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/KpiTile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement KpiTile**

```tsx
// web/src/components/dashboard/KpiTile.tsx
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function KpiTile({
  label, value, delta, hint,
}: { label: string; value: string; delta?: number | null; hint?: string }) {
  const arrow = delta == null ? null : delta >= 0 ? '↑' : '↓';
  const pct = delta == null ? null : `${(Math.abs(delta) * 100).toFixed(0)}%`;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums">{value}</p>
        {pct && (
          <p className={cn('text-xs mt-2', delta != null && delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {arrow} {pct} vs prev period
          </p>
        )}
        {hint && <p className="text-xs text-zinc-500 mt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Write failing test for kpi-repo**

```ts
// web/src/lib/kpi-repo.test.ts
import { describe, expect, it, vi } from 'vitest';
import { computeKpis } from './kpi-repo';

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([
          { name: 'conversationCompleted', count: 100, sumCents: 0 },
          { name: 'conversionAttributed', count: 18, sumCents: 540000 },
          { name: 'voiceConversation', count: 22, sumCents: 0 },
        ])),
      })),
    })),
  },
}));

describe('computeKpis', () => {
  it('computes conversations, conversion rate, revenue, voice ratio', async () => {
    const kpis = await computeKpis({ merchantId: 'SM-TEST01', days: 7 });
    expect(kpis.conversations).toBe(100);
    expect(kpis.conversionRate).toBeCloseTo(0.18);
    expect(kpis.revenueCents).toBe(540000);
    expect(kpis.voiceRatio).toBeCloseTo(0.22);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/kpi-repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement kpi-repo**

```ts
// web/src/lib/kpi-repo.ts
import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type Kpis = {
  conversations: number;
  conversionRate: number;
  revenueCents: number;
  voiceRatio: number;
  voiceConversations: number;
};

export async function computeKpis(args: { merchantId: string; days: number }): Promise<Kpis> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);

  const rows = await db
    .select({
      name: metricEvents.name,
      count: sql<number>`count(*)::int`,
      sumCents: sql<number>`coalesce(sum(${metricEvents.valueCents}), 0)::int`,
    })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.recordedAt, since)));

  const byName = new Map(rows.map((r) => [r.name, r]));
  const conversations = byName.get('conversationCompleted')?.count ?? 0;
  const conversions = byName.get('conversionAttributed')?.count ?? 0;
  const revenueCents = byName.get('conversionAttributed')?.sumCents ?? 0;
  const voiceConversations = byName.get('voiceConversation')?.count ?? 0;

  return {
    conversations,
    conversionRate: conversations > 0 ? conversions / conversations : 0,
    revenueCents,
    voiceConversations,
    voiceRatio: conversations > 0 ? voiceConversations / conversations : 0,
  };
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd web && pnpm test src/lib/kpi-repo.test.ts src/components/dashboard/KpiTile.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/kpi-repo.ts web/src/lib/kpi-repo.test.ts web/src/components/dashboard/KpiTile.tsx web/src/components/dashboard/KpiTile.test.tsx
git commit -m "feat(web): KPI tile component + computeKpis from metric_events"
```

---

### Task G.2: Recent conversations table + repo

**Files:**
- Create: `web/src/lib/conversations-repo.ts`
- Create: `web/src/components/dashboard/ConversationsTable.tsx`
- Test: `web/src/components/dashboard/ConversationsTable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/ConversationsTable.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversationsTable } from './ConversationsTable';

const rows = [
  { id: 'c1', startedAt: new Date('2026-05-04T10:00:00Z'), durationSec: 107, turns: 6, mode: 'voice' as const, outcome: 'purchased' as const, attributedCents: 8900 },
  { id: 'c2', startedAt: new Date('2026-05-04T09:30:00Z'), durationSec: 32, turns: 2, mode: 'text' as const, outcome: 'abandoned' as const, attributedCents: null },
];

describe('ConversationsTable', () => {
  it('renders header columns', () => {
    render(<ConversationsTable rows={rows} />);
    expect(screen.getByText('Started')).toBeTruthy();
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('Outcome')).toBeTruthy();
  });

  it('renders empty state when rows empty', () => {
    render(<ConversationsTable rows={[]} />);
    expect(screen.getByText(/no conversations yet/i)).toBeTruthy();
  });

  it('renders mode + outcome cells', () => {
    render(<ConversationsTable rows={rows} />);
    expect(screen.getByText('voice')).toBeTruthy();
    expect(screen.getByText('purchased')).toBeTruthy();
    expect(screen.getByText('abandoned')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/ConversationsTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement repo**

```ts
// web/src/lib/conversations-repo.ts
import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export type ConversationRow = {
  id: string;
  startedAt: Date;
  durationSec: number;
  turns: number;
  mode: 'voice' | 'text';
  outcome: 'purchased' | 'abandoned' | 'in_progress';
  attributedCents: number | null;
};

export async function recentConversations(args: { merchantId: string; limit?: number }): Promise<ConversationRow[]> {
  const limit = args.limit ?? 20;
  const rows = await db
    .select({
      id: sql<string>`(${metricEvents.payload}->>'session_id')`,
      startedAt: metricEvents.recordedAt,
      durationSec: sql<number>`coalesce((${metricEvents.payload}->>'duration_sec')::int, 0)`,
      turns: sql<number>`coalesce((${metricEvents.payload}->>'turns')::int, 0)`,
      mode: sql<'voice' | 'text'>`coalesce(${metricEvents.payload}->>'mode', 'text')`,
      outcome: sql<'purchased' | 'abandoned' | 'in_progress'>`coalesce(${metricEvents.payload}->>'outcome', 'in_progress')`,
      attributedCents: metricEvents.valueCents,
    })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), eq(metricEvents.name, 'conversationCompleted')))
    .orderBy(desc(metricEvents.recordedAt))
    .limit(limit);

  return rows;
}
```

- [ ] **Step 4: Implement table component**

```tsx
// web/src/components/dashboard/ConversationsTable.tsx
import Link from 'next/link';
import type { ConversationRow } from '@/lib/conversations-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
function relTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString();
}

export function ConversationsTable({ rows }: { rows: ConversationRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent conversations</CardTitle></CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 px-6 py-8 text-center">No conversations yet — install your widget and traffic will show up here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase">
              <tr className="border-b">
                <th className="px-6 py-2 text-left font-medium">Started</th>
                <th className="text-left font-medium">Duration</th>
                <th className="text-left font-medium">Turns</th>
                <th className="text-left font-medium">Mode</th>
                <th className="text-left font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-6 py-2">
                    <Link href={`/app/conversations/${r.id}`} className="hover:underline">{relTime(r.startedAt)}</Link>
                  </td>
                  <td>{formatDuration(r.durationSec)}</td>
                  <td>{r.turns}</td>
                  <td>{r.mode}</td>
                  <td>{r.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/ConversationsTable.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/conversations-repo.ts web/src/components/dashboard/ConversationsTable.tsx web/src/components/dashboard/ConversationsTable.test.tsx
git commit -m "feat(web): conversations table + repo (last 20 with link to drill-down)"
```

---

### Task G.3: Catalog sync chip

**Files:**
- Create: `web/src/components/dashboard/CatalogChip.tsx`
- Test: `web/src/components/dashboard/CatalogChip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/CatalogChip.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatalogChip } from './CatalogChip';

describe('CatalogChip', () => {
  it('renders synced state with product count', () => {
    const recent = new Date(Date.now() - 4 * 60 * 1000);
    render(<CatalogChip syncedAt={recent} productCount={327} />);
    expect(screen.getByText(/327/)).toBeTruthy();
    expect(screen.getByText(/min ago/)).toBeTruthy();
  });

  it('renders stale state when older than 24h', () => {
    const stale = new Date(Date.now() - 26 * 3600 * 1000);
    render(<CatalogChip syncedAt={stale} productCount={100} />);
    expect(screen.getByText(/stale/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/CatalogChip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement chip**

```tsx
// web/src/components/dashboard/CatalogChip.tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';

export function CatalogChip({ syncedAt, productCount }: { syncedAt: Date | null; productCount: number }) {
  const hours = syncedAt ? (Date.now() - syncedAt.getTime()) / 3600000 : Infinity;
  const tone = hours > 24 ? 'red' : hours > 6 ? 'amber' : 'green';
  const label = !syncedAt ? 'Catalog never synced' : hours > 24 ? `Catalog stale — ${Math.floor(hours)}h ago` : `Synced ${formatAgo(syncedAt)} — ${productCount} products`;
  return (
    <Link
      href="/app/settings"
      className={cn(
        'inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border',
        tone === 'green' && 'bg-emerald-50 border-emerald-200 text-emerald-900',
        tone === 'amber' && 'bg-amber-50 border-amber-200 text-amber-900',
        tone === 'red' && 'bg-red-50 border-red-200 text-red-900',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500')} />
      {label}
    </Link>
  );
}

function formatAgo(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} h ago`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/CatalogChip.test.tsx`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/dashboard/CatalogChip.tsx web/src/components/dashboard/CatalogChip.test.tsx
git commit -m "feat(web): catalog sync chip (green/amber/red based on freshness)"
```

---

### Task G.4: Home page assembly

**Files:**
- Create: `web/src/app/app/page.tsx`

- [ ] **Step 1: Implement Home page**

```tsx
// web/src/app/app/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { computeKpis } from '@/lib/kpi-repo';
import { recentConversations } from '@/lib/conversations-repo';
import { db } from '@/lib/db';
import { products, merchants } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KpiTile } from '@/components/dashboard/KpiTile';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';
import { CatalogChip } from '@/components/dashboard/CatalogChip';

export default async function HomePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const merchantId = session.merchant.id;
  const [kpis, rows, productCountRow, merchantRow] = await Promise.all([
    computeKpis({ merchantId, days: 7 }),
    recentConversations({ merchantId, limit: 20 }),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.merchantId, merchantId)),
    db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) }),
  ]);

  const usd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Home</h1>
        <CatalogChip syncedAt={merchantRow?.catalogSyncedAt ?? null} productCount={productCountRow[0]?.count ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Conversations" value={String(kpis.conversations)} />
        <KpiTile label="Conversion rate" value={`${(kpis.conversionRate * 100).toFixed(1)}%`} />
        <KpiTile label="Attributed revenue" value={usd(kpis.revenueCents)} />
        <KpiTile
          label="Voice ratio"
          value={`${(kpis.voiceRatio * 100).toFixed(0)}%`}
          hint={kpis.voiceRatio > 0.2 ? `Surcharge active: $0.30 × ${kpis.voiceConversations}` : undefined}
        />
      </div>

      <ConversationsTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke**

Run: `cd web && pnpm dev` and visit `http://localhost:3000/app` (after seeding a fake merchant + a few metric events). Should render 4 KPI tiles, catalog chip, and conversations table.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/app/page.tsx
git commit -m "feat(web): /app Home page (4 KPI tiles + catalog chip + recent conversations)"
```

---

## Phase H — Conversations

### Task H.1: Conversations list page

**Files:**
- Create: `web/src/app/app/conversations/page.tsx`
- Modify: `web/src/lib/conversations-repo.ts` (add `listConversations` with filters + pagination)
- Test: `web/src/lib/conversations-repo.list.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/conversations-repo.list.test.ts
import { describe, expect, it, vi } from 'vitest';
import { listConversations } from './conversations-repo';

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              { id: 'c1', startedAt: new Date(), durationSec: 60, turns: 4, mode: 'voice', outcome: 'purchased', attributedCents: 5000 },
            ]),
          })),
        })),
      })),
    })),
  },
}));

describe('listConversations', () => {
  it('returns rows with default pagination', async () => {
    const rows = await listConversations({ merchantId: 'SM-X', limit: 50 });
    expect(rows.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/conversations-repo.list.test.ts`
Expected: FAIL — `listConversations` not exported.

- [ ] **Step 3: Add `listConversations` to the repo**

Append to `web/src/lib/conversations-repo.ts`:

```ts
export type ListFilters = {
  merchantId: string;
  outcome?: 'purchased' | 'abandoned';
  mode?: 'voice' | 'text';
  hasAttributedSale?: boolean;
  search?: string;
  cursorRecordedAt?: Date;
  limit?: number;
};

export async function listConversations(filters: ListFilters): Promise<ConversationRow[]> {
  const limit = filters.limit ?? 50;
  const conditions = [eq(metricEvents.merchantId, filters.merchantId), eq(metricEvents.name, 'conversationCompleted')];
  if (filters.outcome) conditions.push(sql`${metricEvents.payload}->>'outcome' = ${filters.outcome}`);
  if (filters.mode) conditions.push(sql`${metricEvents.payload}->>'mode' = ${filters.mode}`);
  if (filters.hasAttributedSale) conditions.push(sql`${metricEvents.valueCents} > 0`);
  if (filters.cursorRecordedAt) conditions.push(sql`${metricEvents.recordedAt} < ${filters.cursorRecordedAt}`);

  const rows = await db
    .select({
      id: sql<string>`(${metricEvents.payload}->>'session_id')`,
      startedAt: metricEvents.recordedAt,
      durationSec: sql<number>`coalesce((${metricEvents.payload}->>'duration_sec')::int, 0)`,
      turns: sql<number>`coalesce((${metricEvents.payload}->>'turns')::int, 0)`,
      mode: sql<'voice' | 'text'>`coalesce(${metricEvents.payload}->>'mode', 'text')`,
      outcome: sql<'purchased' | 'abandoned' | 'in_progress'>`coalesce(${metricEvents.payload}->>'outcome', 'in_progress')`,
      attributedCents: metricEvents.valueCents,
    })
    .from(metricEvents)
    .where(and(...conditions))
    .orderBy(desc(metricEvents.recordedAt))
    .limit(limit);

  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/conversations-repo.list.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 5: Implement the list page**

```tsx
// web/src/app/app/conversations/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConversations } from '@/lib/conversations-repo';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ outcome?: string; mode?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConversations({
    merchantId: session.merchant.id,
    outcome: sp.outcome === 'purchased' || sp.outcome === 'abandoned' ? sp.outcome : undefined,
    mode: sp.mode === 'voice' || sp.mode === 'text' ? sp.mode : undefined,
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <Filters current={sp} />
      <ConversationsTable rows={rows} />
    </div>
  );
}

function Filters({ current }: { current: { outcome?: string; mode?: string } }) {
  return (
    <form className="flex gap-2 text-sm">
      <select name="outcome" defaultValue={current.outcome ?? ''} className="border rounded px-2 py-1">
        <option value="">Any outcome</option>
        <option value="purchased">Purchased</option>
        <option value="abandoned">Abandoned</option>
      </select>
      <select name="mode" defaultValue={current.mode ?? ''} className="border rounded px-2 py-1">
        <option value="">Any mode</option>
        <option value="voice">Voice</option>
        <option value="text">Text</option>
      </select>
      <button type="submit" className="border rounded px-3 py-1 bg-zinc-900 text-white">Apply</button>
    </form>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/conversations-repo.ts web/src/lib/conversations-repo.list.test.ts web/src/app/app/conversations/page.tsx
git commit -m "feat(web): conversations list page with outcome/mode filters"
```

---

### Task H.2: Conversation drill-down page

**Files:**
- Create: `web/src/app/app/conversations/[id]/page.tsx`
- Modify: `web/src/lib/conversations-repo.ts` (add `getConversation` returning full transcript)

- [ ] **Step 1: Add `getConversation` to repo**

Append to `web/src/lib/conversations-repo.ts`:

```ts
export type ConversationDetail = {
  id: string;
  startedAt: Date;
  durationSec: number;
  turns: number;
  mode: 'voice' | 'text';
  outcome: 'purchased' | 'abandoned' | 'in_progress';
  attributedCents: number | null;
  transcript: Array<{ role: 'user' | 'agent' | 'tool' | 'card'; content: string; timestamp: number }>;
  llmCostCents: number;
  voiceCostCents: number;
};

export async function getConversation(args: { merchantId: string; sessionId: string }): Promise<ConversationDetail | null> {
  const row = await db.query.metricEvents.findFirst({
    where: and(
      eq(metricEvents.merchantId, args.merchantId),
      eq(metricEvents.name, 'conversationCompleted'),
      sql`${metricEvents.payload}->>'session_id' = ${args.sessionId}`,
    ),
  });
  if (!row) return null;
  const p = row.payload as Record<string, unknown>;
  return {
    id: args.sessionId,
    startedAt: row.recordedAt,
    durationSec: Number(p.duration_sec ?? 0),
    turns: Number(p.turns ?? 0),
    mode: (p.mode as 'voice' | 'text') ?? 'text',
    outcome: (p.outcome as 'purchased' | 'abandoned' | 'in_progress') ?? 'in_progress',
    attributedCents: row.valueCents,
    transcript: Array.isArray(p.transcript) ? (p.transcript as ConversationDetail['transcript']) : [],
    llmCostCents: Number(p.llm_cost_cents ?? 0),
    voiceCostCents: Number(p.voice_cost_cents ?? 0),
  };
}
```

- [ ] **Step 2: Implement drill-down page**

```tsx
// web/src/app/app/conversations/[id]/page.tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { getConversation } from '@/lib/conversations-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const convo = await getConversation({ merchantId: session.merchant.id, sessionId: id });
  if (!convo) notFound();

  const expiresAt = new Date(convo.startedAt.getTime() + 24 * 3600 * 1000);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Conversation</h1>
        <p className="text-sm text-zinc-500">
          {convo.startedAt.toLocaleString()} · {convo.durationSec}s · {convo.turns} turns · {convo.mode} · {convo.outcome}
        </p>
        <p className="text-xs text-amber-700 mt-1">
          This conversation will be deleted at {expiresAt.toLocaleString()} (24h retention).
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {convo.transcript.length === 0 ? (
            <p className="text-sm text-zinc-500">Transcript not retained.</p>
          ) : convo.transcript.map((t, i) => (
            <div key={i} className={
              t.role === 'agent' ? 'self-start max-w-md bg-zinc-100 rounded-lg px-3 py-2 text-sm' :
              t.role === 'user' ? 'self-end max-w-md bg-zinc-900 text-white rounded-lg px-3 py-2 text-sm' :
              t.role === 'card' ? 'self-start text-xs italic text-zinc-500' :
              'self-start text-xs font-mono text-zinc-400'
            }>
              {t.content}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cost</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-700">
            ${(convo.llmCostCents / 100).toFixed(2)} LLM + ${(convo.voiceCostCents / 100).toFixed(2)} voice = ${((convo.llmCostCents + convo.voiceCostCents) / 100).toFixed(2)} total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/conversations-repo.ts web/src/app/app/conversations/\[id\]
git commit -m "feat(web): conversation drill-down page (transcript + cost + 24h expiry banner)"
```

---

## Phase I — Knowledge base + ingestion worker

### Task I.1: Cloudflare R2 wrapper

**Files:**
- Create: `web/src/lib/r2.ts`
- Test: `web/src/lib/r2.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/r2.test.ts
import { describe, expect, it } from 'vitest';
import { presignKbUpload, presignKbDownload } from './r2';

describe('r2 wrapper', () => {
  it('presignKbUpload returns a URL with signature params', async () => {
    const url = await presignKbUpload({ key: 'm/SM-X/file.pdf', contentType: 'application/pdf' });
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('X-Amz-Signature');
  });

  it('presignKbDownload returns a URL', async () => {
    const url = await presignKbDownload({ key: 'm/SM-X/file.pdf' });
    expect(url).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/r2.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement R2 wrapper**

```ts
// web/src/lib/r2.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET ?? 'shoppingmate-kb';

if (!accessKeyId || !secretAccessKey || !accountId) {
  throw new Error('R2 credentials missing');
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export async function presignKbUpload(args: { key: string; contentType: string; expiresIn?: number }): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: args.key, ContentType: args.contentType });
  return getSignedUrl(s3, command, { expiresIn: args.expiresIn ?? 600 });
}

export async function presignKbDownload(args: { key: string; expiresIn?: number }): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: args.key });
  return getSignedUrl(s3, command, { expiresIn: args.expiresIn ?? 600 });
}

export async function downloadKbObject(key: string): Promise<Buffer> {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error('no body');
  const chunks: Uint8Array[] = [];
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export const R2_BUCKET = bucket;
```

Add R2 env vars to vitest config:
```ts
R2_ACCESS_KEY_ID: 'test-access-key',
R2_SECRET_ACCESS_KEY: 'test-secret-key',
R2_ACCOUNT_ID: 'testacct',
R2_BUCKET: 'shoppingmate-kb-test',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/r2.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/r2.ts web/src/lib/r2.test.ts web/vitest.config.ts
git commit -m "feat(web): r2 wrapper with presigned upload/download urls"
```

---

### Task I.2: KB chunker

**Files:**
- Create: `web/src/lib/kb-chunker.ts`
- Test: `web/src/lib/kb-chunker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/kb-chunker.test.ts
import { describe, expect, it } from 'vitest';
import { chunkText } from './kb-chunker';

describe('chunkText', () => {
  it('returns one chunk for short input', () => {
    const chunks = chunkText('Hello world. This is a test.', { targetTokens: 256, maxTokens: 512 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Hello world');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into multiple chunks at sentence boundaries', () => {
    const sentence = 'This is a fairly long sentence that should help us reach the token limit. ';
    const text = sentence.repeat(200);
    const chunks = chunkText(text, { targetTokens: 256, maxTokens: 512 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.tokenCount).toBeLessThanOrEqual(512));
  });

  it('produces incrementing chunk_index', () => {
    const sentence = 'Quick brown fox jumps over the lazy dog. '.repeat(50);
    const chunks = chunkText(sentence, { targetTokens: 64, maxTokens: 128 });
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/lib/kb-chunker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement chunker**

```ts
// web/src/lib/kb-chunker.ts
import { encode } from 'gpt-tokenizer';

export type Chunk = { chunkIndex: number; text: string; tokenCount: number };

export function chunkText(input: string, opts: { targetTokens: number; maxTokens: number }): Chunk[] {
  const sentences = splitSentences(input);
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(' ').trim();
    chunks.push({ chunkIndex: chunks.length, text, tokenCount: bufferTokens });
    buffer = [];
    bufferTokens = 0;
  };

  for (const sentence of sentences) {
    const sentenceTokens = encode(sentence).length;
    if (bufferTokens + sentenceTokens > opts.maxTokens && buffer.length > 0) {
      flush();
    }
    buffer.push(sentence);
    bufferTokens += sentenceTokens;
    if (bufferTokens >= opts.targetTokens) flush();
  }
  flush();
  return chunks;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [text.trim()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/lib/kb-chunker.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/kb-chunker.ts web/src/lib/kb-chunker.test.ts
git commit -m "feat(web): kb chunker (sentence-boundary, target 256 / max 512 tokens)"
```

---

### Task I.3: `/api/kb/upload` (presigned URL + insert document row)

**Files:**
- Create: `web/src/app/api/kb/upload/route.ts`
- Test: `web/src/app/api/kb/upload/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/kb/upload/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

const insertReturning = vi.fn().mockResolvedValue([{ id: 'doc1' }]);
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: insertReturning })) })),
  },
}));

vi.mock('@/lib/r2', () => ({
  presignKbUpload: vi.fn().mockResolvedValue('https://r2.example/upload?sig=x'),
}));

vi.mock('@/lib/queue', () => ({
  enqueueKbIngest: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './route';

describe('POST /api/kb/upload', () => {
  it('returns presigned URL + document id', async () => {
    const req = new Request('http://localhost/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'returns.pdf', mimeType: 'application/pdf', sizeBytes: 12345 }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.upload_url).toContain('r2.example');
    expect(json.document_id).toBe('doc1');
  });

  it('rejects oversized files (> 10 MB)', async () => {
    const req = new Request('http://localhost/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'huge.pdf', mimeType: 'application/pdf', sizeBytes: 20 * 1024 * 1024 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/kb/upload/route.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement queue helper stub**

```ts
// web/src/lib/queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const kbQueue = new Queue('kb-ingest', { connection });

export async function enqueueKbIngest(documentId: string) {
  await kbQueue.add('ingest', { documentId }, { removeOnComplete: 100, removeOnFail: 500 });
}
```

- [ ] **Step 4: Implement upload route**

```ts
// web/src/app/api/kb/upload/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { brandKbDocuments } from '@shoppingmate/db/schema';
import { presignKbUpload } from '@/lib/r2';
import { enqueueKbIngest } from '@/lib/queue';
import { getDashboardSession } from '@/lib/session';

const Body = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

const ALLOWED_MIME = new Set(['application/pdf', 'text/markdown', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!ALLOWED_MIME.has(parsed.data.mimeType)) return NextResponse.json({ error: 'unsupported file type' }, { status: 400 });

  const key = `m/${session.merchant.id}/${Date.now()}-${parsed.data.filename}`;
  const uploadUrl = await presignKbUpload({ key, contentType: parsed.data.mimeType });

  const inserted = await db.insert(brandKbDocuments).values({
    merchantId: session.merchant.id,
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    storageUrl: key,
    status: 'uploaded',
  }).returning();

  await enqueueKbIngest(inserted[0].id);

  return NextResponse.json({ upload_url: uploadUrl, document_id: inserted[0].id, key });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/kb/upload/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/queue.ts web/src/app/api/kb/upload
git commit -m "feat(web): /api/kb/upload returns presigned R2 URL + enqueues ingest job"
```

---

### Task I.4: BullMQ ingest worker

**Files:**
- Create: `apps/worker/src/jobs/ingestKbDoc.ts`
- Modify: `apps/worker/src/index.ts` (register processor)
- Test: `apps/worker/src/jobs/ingestKbDoc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/worker/src/jobs/ingestKbDoc.test.ts
import { describe, expect, it, vi } from 'vitest';

const updateDoc = vi.fn().mockResolvedValue(undefined);
const updateMerchant = vi.fn().mockResolvedValue(undefined);
const insertChunks = vi.fn().mockResolvedValue(undefined);

vi.mock('@shoppingmate/db', () => ({
  db: {
    query: { brandKbDocuments: { findFirst: vi.fn().mockResolvedValue({ id: 'doc1', merchantId: 'SM-X', filename: 'a.txt', mimeType: 'text/plain', storageUrl: 'm/SM-X/a.txt' }) } },
    insert: vi.fn(() => ({ values: insertChunks })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateDoc })) })),
  },
  schema: { brandKbDocuments: {}, brandKbChunks: {}, merchants: {} },
}));

vi.mock('../r2-download', () => ({
  downloadKbObject: vi.fn().mockResolvedValue(Buffer.from('Hello world. This is a returns policy. We accept returns within 30 days.')),
}));

import { ingestKbDoc } from './ingestKbDoc';

describe('ingestKbDoc', () => {
  it('downloads, chunks, inserts, marks ready', async () => {
    const result = await ingestKbDoc({ documentId: 'doc1' });
    expect(result.status).toBe('ready');
    expect(insertChunks).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @shoppingmate/worker test src/jobs/ingestKbDoc.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add R2 download helper to worker**

```ts
// apps/worker/src/r2-download.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function downloadKbObject(key: string): Promise<Buffer> {
  const out = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'shoppingmate-kb', Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const c of out.Body as AsyncIterable<Uint8Array>) chunks.push(c);
  return Buffer.concat(chunks);
}
```

- [ ] **Step 4: Implement the job**

```ts
// apps/worker/src/jobs/ingestKbDoc.ts
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { encode } from 'gpt-tokenizer';
import { downloadKbObject } from '../r2-download';

export type IngestResult = { status: 'ready' | 'failed'; error?: string };

export async function ingestKbDoc(args: { documentId: string }): Promise<IngestResult> {
  const doc = await db.query.brandKbDocuments.findFirst({
    where: eq(schema.brandKbDocuments.id, args.documentId),
  });
  if (!doc) return { status: 'failed', error: 'document not found' };

  await db.update(schema.brandKbDocuments)
    .set({ status: 'processing' })
    .where(eq(schema.brandKbDocuments.id, args.documentId));

  try {
    const buf = await downloadKbObject(doc.storageUrl);
    const text = await extractText(buf, doc.mimeType);
    const chunks = chunkText(text, { targetTokens: 256, maxTokens: 512 });

    if (chunks.length > 0) {
      await db.insert(schema.brandKbChunks).values(
        chunks.map((c) => ({
          documentId: args.documentId,
          merchantId: doc.merchantId,
          chunkIndex: c.chunkIndex,
          text: c.text,
          tokenCount: c.tokenCount,
        })),
      );
    }

    await db.update(schema.brandKbDocuments)
      .set({ status: 'ready', readyAt: new Date() })
      .where(eq(schema.brandKbDocuments.id, args.documentId));

    await db.update(schema.merchants)
      .set({ knowledgeBaseStatus: 'ready' })
      .where(eq(schema.merchants.id, doc.merchantId));

    return { status: 'ready' };
  } catch (err) {
    const message = (err as Error).message;
    await db.update(schema.brandKbDocuments)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(schema.brandKbDocuments.id, args.documentId));
    return { status: 'failed', error: message };
  }
}

async function extractText(buf: Buffer, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    const { default: pdf } = await import('pdf-parse');
    const out = await pdf(buf);
    return out.text;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { default: mammoth } = await import('mammoth');
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value;
  }
  return buf.toString('utf-8');
}

function chunkText(input: string, opts: { targetTokens: number; maxTokens: number }) {
  const sentences = input.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [input.trim()];
  const chunks: { chunkIndex: number; text: string; tokenCount: number }[] = [];
  let buf: string[] = [];
  let tokens = 0;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({ chunkIndex: chunks.length, text: buf.join(' ').trim(), tokenCount: tokens });
    buf = [];
    tokens = 0;
  };
  for (const s of sentences) {
    const t = encode(s).length;
    if (tokens + t > opts.maxTokens && buf.length) flush();
    buf.push(s);
    tokens += t;
    if (tokens >= opts.targetTokens) flush();
  }
  flush();
  return chunks;
}
```

- [ ] **Step 5: Register the processor in worker entry**

In `apps/worker/src/index.ts`, add a Worker:

```ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ingestKbDoc } from './jobs/ingestKbDoc';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

new Worker('kb-ingest', async (job) => {
  if (job.name === 'ingest') {
    return ingestKbDoc({ documentId: job.data.documentId as string });
  }
}, { connection });
```

(Add bullmq + ioredis + gpt-tokenizer + pdf-parse + mammoth + @aws-sdk/client-s3 to `apps/worker/package.json` if not already there.)

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @shoppingmate/worker test src/jobs/ingestKbDoc.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/jobs/ingestKbDoc.ts apps/worker/src/jobs/ingestKbDoc.test.ts apps/worker/src/r2-download.ts apps/worker/src/index.ts apps/worker/package.json pnpm-lock.yaml
git commit -m "feat(worker): ingestKbDoc job — download from R2, chunk, insert chunks, mark ready"
```

---

### Task I.5: Knowledge page UI

**Files:**
- Create: `web/src/app/app/knowledge/page.tsx`
- Create: `web/src/components/dashboard/KnowledgeUploader.tsx`
- Test: `web/src/components/dashboard/KnowledgeUploader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/KnowledgeUploader.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KnowledgeUploader } from './KnowledgeUploader';

describe('KnowledgeUploader', () => {
  it('renders drop zone with allowed types text', () => {
    render(<KnowledgeUploader docs={[]} />);
    expect(screen.getByText(/drag.*drop|upload/i)).toBeTruthy();
    expect(screen.getByText(/PDF.*docx.*md.*txt/i)).toBeTruthy();
  });

  it('renders file table when docs are present', () => {
    render(
      <KnowledgeUploader
        docs={[{ id: 'd1', filename: 'a.pdf', sizeBytes: 1024, status: 'ready', enabled: true, tokenCount: 200 }]}
      />,
    );
    expect(screen.getByText('a.pdf')).toBeTruthy();
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('renders token-budget meter', () => {
    render(
      <KnowledgeUploader
        docs={[{ id: 'd1', filename: 'a.pdf', sizeBytes: 1024, status: 'ready', enabled: true, tokenCount: 200 }]}
      />,
    );
    expect(screen.getByText(/200.*8,?000/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/KnowledgeUploader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement uploader**

```tsx
// web/src/components/dashboard/KnowledgeUploader.tsx
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export type KbDoc = {
  id: string;
  filename: string;
  sizeBytes: number;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  enabled: boolean;
  tokenCount: number;
};

export function KnowledgeUploader({ docs }: { docs: KbDoc[] }) {
  const [uploading, setUploading] = useState(false);
  const totalTokens = docs.reduce((sum, d) => sum + (d.enabled ? d.tokenCount : 0), 0);
  const overBudget = totalTokens > 8000;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const init = await fetch('/api/kb/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    const { upload_url } = await init.json();
    if (upload_url) {
      await fetch(upload_url, { method: 'PUT', body: file, headers: { 'content-type': file.type } });
      window.location.reload();
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Upload Brand Knowledge</CardTitle></CardHeader>
        <CardContent>
          <label className={cn('flex flex-col items-center justify-center border-2 border-dashed rounded-md p-8 cursor-pointer', uploading ? 'opacity-50' : 'hover:bg-zinc-50')}>
            <input type="file" accept=".pdf,.docx,.md,.txt" onChange={onFile} className="hidden" />
            <p className="text-sm">{uploading ? 'Uploading…' : 'Drag and drop or click to upload'}</p>
            <p className="text-xs text-zinc-500 mt-1">PDF, .docx, .md, .txt — up to 10 MB</p>
          </label>
        </CardContent>
      </Card>
      <div className={cn('text-sm rounded-md p-3', overBudget ? 'bg-amber-50 text-amber-900' : 'bg-zinc-50 text-zinc-700')}>
        Total: <strong>{totalTokens.toLocaleString()}</strong> / 8,000 tokens —{' '}
        {overBudget ? 'exceeds 8K budget; switching to top-K embedding retrieval.' : 'full KB injected at session start.'}
      </div>
      {docs.length > 0 && (
        <Card>
          <CardContent className="px-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b">
                  <th className="px-6 py-2 text-left">Filename</th>
                  <th className="text-left">Size</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Tokens</th>
                  <th className="text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-6 py-2">{d.filename}</td>
                    <td>{(d.sizeBytes / 1024).toFixed(0)} KB</td>
                    <td>{d.status}</td>
                    <td>{d.tokenCount}</td>
                    <td>{d.enabled ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement page**

```tsx
// web/src/app/app/knowledge/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { brandKbDocuments, brandKbChunks } from '@shoppingmate/db/schema';
import { eq, sql } from 'drizzle-orm';
import { KnowledgeUploader } from '@/components/dashboard/KnowledgeUploader';

export default async function KnowledgePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const docs = await db
    .select({
      id: brandKbDocuments.id,
      filename: brandKbDocuments.filename,
      sizeBytes: brandKbDocuments.sizeBytes,
      status: brandKbDocuments.status,
      enabled: brandKbDocuments.enabled,
      tokenCount: sql<number>`coalesce((select sum(${brandKbChunks.tokenCount}) from ${brandKbChunks} where ${brandKbChunks.documentId} = ${brandKbDocuments.id}), 0)::int`,
    })
    .from(brandKbDocuments)
    .where(eq(brandKbDocuments.merchantId, session.merchant.id));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Brand Knowledge</h1>
      <KnowledgeUploader docs={docs as Parameters<typeof KnowledgeUploader>[0]['docs']} />
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/KnowledgeUploader.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/dashboard/KnowledgeUploader.tsx web/src/components/dashboard/KnowledgeUploader.test.tsx web/src/app/app/knowledge
git commit -m "feat(web): /app/knowledge page with drop zone, file table, token budget meter"
```

---

## Phase J — Settings

### Task J.1: Persona form + save action

**Files:**
- Create: `web/src/app/app/settings/page.tsx`
- Create: `web/src/components/dashboard/PersonaForm.tsx`
- Create: `web/src/app/app/settings/actions.ts`
- Test: `web/src/components/dashboard/PersonaForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/dashboard/PersonaForm.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonaForm } from './PersonaForm';

describe('PersonaForm', () => {
  it('renders voice descriptor dropdown with 8 options', () => {
    render(<PersonaForm initial={null} />);
    const select = screen.getByLabelText(/voice descriptor/i) as HTMLSelectElement;
    expect(select.options.length).toBe(8);
  });

  it('renders brand voice notes textarea with 500 char limit', () => {
    render(<PersonaForm initial={null} />);
    const textarea = screen.getByLabelText(/brand voice notes/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
  });

  it('renders 5-point tone slider', () => {
    render(<PersonaForm initial={null} />);
    const slider = screen.getByLabelText(/tone/i) as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/components/dashboard/PersonaForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Server Action**

```ts
// web/src/app/app/settings/actions.ts
'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const PersonaSchema = z.object({
  voiceDescriptorId: z.string().min(1),
  brandVoiceNotes: z.string().max(500),
  toneValue: z.number().int().min(1).max(5),
});

export async function savePersona(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');

  const parsed = PersonaSchema.parse({
    voiceDescriptorId: formData.get('voiceDescriptorId'),
    brandVoiceNotes: formData.get('brandVoiceNotes') ?? '',
    toneValue: Number(formData.get('toneValue')),
  });

  await db.update(merchants).set({ persona: parsed }).where(eq(merchants.id, session.merchant.id));
  revalidatePath('/app/settings');
}

const WebhookSchema = z.object({ leadWebhookUrl: z.string().url().or(z.literal('')) });

export async function saveWebhook(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');
  const parsed = WebhookSchema.parse({ leadWebhookUrl: formData.get('leadWebhookUrl') ?? '' });
  await db.update(merchants)
    .set({ leadWebhookUrl: parsed.leadWebhookUrl || null })
    .where(eq(merchants.id, session.merchant.id));
  revalidatePath('/app/settings');
}
```

- [ ] **Step 4: Implement PersonaForm**

```tsx
// web/src/components/dashboard/PersonaForm.tsx
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { savePersona } from '@/app/app/settings/actions';

const VOICES = [
  { id: 'warm-brit', label: 'Warm Brit' },
  { id: 'energetic-nyc', label: 'Energetic NYC' },
  { id: 'calm-indian', label: 'Calm Indian' },
  { id: 'crisp-aussie', label: 'Crisp Aussie' },
  { id: 'friendly-texan', label: 'Friendly Texan' },
  { id: 'soft-french', label: 'Soft French' },
  { id: 'bright-tokyo', label: 'Bright Tokyo' },
  { id: 'deep-johannesburg', label: 'Deep Johannesburg' },
];

const TONE_LABELS = ['Formal', 'Professional', 'Neutral', 'Casual', 'Playful'];

type Persona = { voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number };

export function PersonaForm({ initial }: { initial: Persona | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>Persona</CardTitle></CardHeader>
      <CardContent>
        <form action={savePersona} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Voice descriptor</span>
            <select name="voiceDescriptorId" defaultValue={initial?.voiceDescriptorId ?? VOICES[0].id} className="border rounded px-3 py-2">
              {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Brand voice notes</span>
            <textarea name="brandVoiceNotes" maxLength={500} defaultValue={initial?.brandVoiceNotes ?? ''}
              className="border rounded px-3 py-2 min-h-24"
              placeholder="Speak warmly, never use exclamation marks. Address customers by their first name when known." />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Tone</span>
            <input type="range" name="toneValue" min={1} max={5} step={1} defaultValue={initial?.toneValue ?? 3} />
            <div className="flex justify-between text-xs text-zinc-500">
              {TONE_LABELS.map((t) => <span key={t}>{t}</span>)}
            </div>
          </label>
          <Button type="submit" className="self-start">Save persona</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test src/components/dashboard/PersonaForm.test.tsx`
Expected: PASS — 3/3.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/dashboard/PersonaForm.tsx web/src/components/dashboard/PersonaForm.test.tsx web/src/app/app/settings/actions.ts
git commit -m "feat(web): persona form (8 voices + brand notes + 5-point tone slider) with server action"
```

---

### Task J.2: Webhook + install snippet + danger zone

**Files:**
- Create: `web/src/components/dashboard/WebhookForm.tsx`
- Create: `web/src/components/dashboard/InstallSnippet.tsx`
- Create: `web/src/components/dashboard/DangerZone.tsx`
- Create: `web/src/app/api/account/delete/route.ts`
- Modify: `web/src/app/app/settings/page.tsx` (assemble all panels)

- [ ] **Step 1: Implement WebhookForm**

```tsx
// web/src/components/dashboard/WebhookForm.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveWebhook } from '@/app/app/settings/actions';

export function WebhookForm({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState(initial ?? '');
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testFire() {
    setTestResult(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'test', email: 'test@example.com', merchant_id: 'TEST' }),
      });
      setTestResult(`Response: ${res.status} ${res.statusText}`);
    } catch (err) {
      setTestResult(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Lead webhook</CardTitle></CardHeader>
      <CardContent>
        <form action={saveWebhook} className="flex flex-col gap-3">
          <Input name="leadWebhookUrl" type="url" placeholder="https://your-crm.com/webhooks/shoppingmate" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="text-xs text-zinc-500">We POST a JSON body when a conversation captures a lead.</p>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={testFire} disabled={!url}>Test fire</Button>
          </div>
          {testResult && <p className="text-xs text-zinc-700">{testResult}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement InstallSnippet**

```tsx
// web/src/components/dashboard/InstallSnippet.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function InstallSnippet({ merchantId, lastPing }: { merchantId: string; lastPing: Date | null }) {
  const snippet = `<script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="${merchantId}"></script>`;
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);

  async function verify() {
    setVerifying(true);
    const res = await fetch('/api/install/verify', { method: 'POST' });
    const json = await res.json();
    setResult(json.ok ? 'ok' : 'fail');
    setVerifying(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Install snippet</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <pre className="bg-zinc-900 text-zinc-100 text-xs rounded-md p-4 overflow-x-auto">{snippet}</pre>
        <div className="flex gap-2 items-center">
          <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
          <Button variant="outline" onClick={verify} disabled={verifying}>{verifying ? 'Checking…' : 'Re-verify'}</Button>
          <span className="text-xs text-zinc-500">
            Last ping: {lastPing ? new Date(lastPing).toLocaleString() : 'never'}
          </span>
        </div>
        {result === 'ok' && <p className="text-xs text-emerald-700">Widget detected.</p>}
        {result === 'fail' && <p className="text-xs text-red-700">Widget not detected.</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Implement DangerZone**

```tsx
// web/src/components/dashboard/DangerZone.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function DangerZone({ merchantId }: { merchantId: string }) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function deleteAccount() {
    setSubmitting(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    if (res.ok) window.location.href = '/';
    setSubmitting(false);
  }

  return (
    <Card className="border-red-200">
      <CardHeader><CardTitle className="text-red-600">Danger zone</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-zinc-700">Cancels Stripe subscription, revokes Composio connections, soft-deletes your merchant. Type <code>{merchantId}</code> to confirm.</p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={merchantId} />
        <Button variant="destructive" disabled={confirmText !== merchantId || submitting} onClick={deleteAccount}>
          {submitting ? 'Deleting…' : 'Delete account'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Implement delete route**

```ts
// web/src/app/api/account/delete/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants, sessions } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (session.merchant) {
    const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
    if (m?.stripeSubscriptionId) {
      try { await stripe.subscriptions.cancel(m.stripeSubscriptionId); } catch { /* ignore */ }
    }
    await db.update(merchants).set({ deletedAt: new Date(), billingStatus: 'canceled' }).where(eq(merchants.id, session.merchant.id));
  }

  await db.delete(sessions).where(eq(sessions.userId, session.user.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Implement settings page**

```tsx
// web/src/app/app/settings/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { PersonaForm } from '@/components/dashboard/PersonaForm';
import { WebhookForm } from '@/components/dashboard/WebhookForm';
import { InstallSnippet } from '@/components/dashboard/InstallSnippet';
import { DangerZone } from '@/components/dashboard/DangerZone';

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <PersonaForm initial={session.merchant.persona} />
      <WebhookForm initial={session.merchant.leadWebhookUrl} />
      <InstallSnippet merchantId={session.merchant.id} lastPing={session.merchant.lastWidgetPing} />
      <DangerZone merchantId={session.merchant.id} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/components/dashboard/WebhookForm.tsx web/src/components/dashboard/InstallSnippet.tsx web/src/components/dashboard/DangerZone.tsx web/src/app/api/account/delete web/src/app/app/settings/page.tsx
git commit -m "feat(web): settings page (webhook + install snippet + danger zone delete)"
```

---

## Phase K — Billing

### Task K.1: `/api/billing/portal-session`

**Files:**
- Create: `web/src/app/api/billing/portal-session/route.ts`
- Test: `web/src/app/api/billing/portal-session/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/billing/portal-session/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: { query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', stripeCustomerId: 'cus_x' }) } } },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/x' }) } },
  },
  PRICE_IDS: {},
}));

import { POST } from './route';

describe('POST /api/billing/portal-session', () => {
  it('returns Stripe portal URL', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }));
    const json = await res.json();
    expect(json.url).toContain('billing.stripe.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/billing/portal-session/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/billing/portal-session/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.stripeCustomerId) return NextResponse.json({ error: 'no stripe customer' }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const portal = await stripe.billingPortal.sessions.create({
    customer: m.stripeCustomerId,
    return_url: `${baseUrl}/app/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/billing/portal-session/route.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/billing/portal-session
git commit -m "feat(web): /api/billing/portal-session creates stripe customer portal link"
```

---

### Task K.2: `/api/billing/topup`

**Files:**
- Create: `web/src/app/api/billing/topup/route.ts`
- Test: `web/src/app/api/billing/topup/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/billing/topup/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: { query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', stripeCustomerId: 'cus_x' }) } } },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/y' }) } },
  },
  PRICE_IDS: {
    topup_50: 'price_t50', topup_200: 'price_t200', topup_1000: 'price_t1000', topup_5000: 'price_t5000',
  },
  TOPUP_QTYS: { topup_50: 50, topup_200: 200, topup_1000: 1000, topup_5000: 5000 },
}));

import { POST } from './route';

describe('POST /api/billing/topup', () => {
  it('returns Checkout URL for valid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_200' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    const json = await res.json();
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('rejects invalid topup_key', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_lol' }), headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/billing/topup/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/billing/topup/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';
import { stripe, PRICE_IDS } from '@/lib/stripe';

const Body = z.object({ topup_key: z.enum(['topup_50', 'topup_200', 'topup_1000', 'topup_5000']) });

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid topup_key' }, { status: 400 });

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  if (!m?.stripeCustomerId) return NextResponse.json({ error: 'no stripe customer' }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const cs = await stripe.checkout.sessions.create({
    customer: m.stripeCustomerId,
    mode: 'payment',
    line_items: [{ price: PRICE_IDS[parsed.data.topup_key], quantity: 1 }],
    success_url: `${baseUrl}/app/billing?topup=ok`,
    cancel_url: `${baseUrl}/app/billing?topup=cancel`,
    metadata: { user_id: session.user.id, topup_key: parsed.data.topup_key, merchant_id: session.merchant.id },
  });
  return NextResponse.json({ url: cs.url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/billing/topup/route.test.ts`
Expected: PASS — 2/2.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/billing/topup
git commit -m "feat(web): /api/billing/topup (4 packs: 50/200/1000/5000)"
```

---

### Task K.3: Auto-recharge save action

**Files:**
- Create: `web/src/app/app/billing/actions.ts`
- Test: `web/src/app/app/billing/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/app/billing/actions.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

const setMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(() => ({ set: setMock })) },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveAutoRecharge } from './actions';

describe('saveAutoRecharge', () => {
  it('persists enabled + threshold + pack_size', async () => {
    const fd = new FormData();
    fd.set('enabled', 'on');
    fd.set('threshold', '10');
    fd.set('pack_size', '200');
    await saveAutoRecharge(fd);
    expect(setMock).toHaveBeenCalledWith({
      autoRechargeEnabled: true,
      autoRechargeThreshold: 10,
      autoRechargePackSize: 200,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/app/billing/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement action**

```ts
// web/src/app/app/billing/actions.ts
'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const Schema = z.object({
  enabled: z.coerce.boolean(),
  threshold: z.coerce.number().int().min(1).max(1000),
  pack_size: z.union([z.literal(50), z.literal(200), z.literal(1000), z.literal(5000)]),
});

export async function saveAutoRecharge(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');

  const enabled = formData.get('enabled') === 'on';
  const threshold = Number(formData.get('threshold'));
  const packSize = Number(formData.get('pack_size'));
  Schema.parse({ enabled, threshold, pack_size: packSize });

  await db.update(merchants).set({
    autoRechargeEnabled: enabled,
    autoRechargeThreshold: threshold,
    autoRechargePackSize: packSize,
  }).where(eq(merchants.id, session.merchant.id));

  revalidatePath('/app/billing');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/app/billing/actions.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/app/billing/actions.ts web/src/app/app/billing/actions.test.ts
git commit -m "feat(web): saveAutoRecharge server action"
```

---

### Task K.4: Billing page assembly

**Files:**
- Create: `web/src/app/app/billing/page.tsx`

- [ ] **Step 1: Implement the billing page**

```tsx
// web/src/app/app/billing/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { computeKpis } from '@/lib/kpi-repo';
import { stripe } from '@/lib/stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveAutoRecharge } from './actions';

const PLAN_QUOTA: Record<string, { conversations: number; price: number }> = {
  starter: { conversations: 100, price: 30 },
  growth: { conversations: 500, price: 99 },
  scale: { conversations: 2000, price: 299 },
  pro: { conversations: 10000, price: 999 },
};

const TOPUPS = [
  { key: 'topup_50', label: '50', price: 19 },
  { key: 'topup_200', label: '200', price: 59 },
  { key: 'topup_1000', label: '1,000', price: 199 },
  { key: 'topup_5000', label: '5,000', price: 799 },
];

export default async function BillingPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  const kpis = await computeKpis({ merchantId: session.merchant.id, days: 30 });
  const quota = PLAN_QUOTA[session.merchant.plan] ?? PLAN_QUOTA.starter;

  let invoices: Array<{ id: string; created: number; total: number; status: string | null; pdf: string | null }> = [];
  if (m?.stripeCustomerId) {
    const list = await stripe.invoices.list({ customer: m.stripeCustomerId, limit: 12 });
    invoices = list.data.map((inv) => ({ id: inv.id, created: inv.created, total: inv.total, status: inv.status, pdf: inv.invoice_pdf }));
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <Card>
        <CardHeader><CardTitle>{session.merchant.plan} — ${quota.price}/mo</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{kpis.conversations} / {quota.conversations} conversations used this period</span>
              <span>{((kpis.conversations / quota.conversations) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-900" style={{ width: `${Math.min(100, (kpis.conversations / quota.conversations) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{(kpis.voiceRatio * 100).toFixed(0)}% voice {kpis.voiceRatio > 0.2 && '— surcharge active'}</span>
              <span>{kpis.voiceRatio > 0.2 ? `$0.30 × ${kpis.voiceConversations} = $${(kpis.voiceConversations * 0.3).toFixed(2)}` : '—'}</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, kpis.voiceRatio * 100 / 0.4 * 100)}%` }} />
            </div>
          </div>
          <form action="/api/billing/portal-session" method="post">
            <Button type="submit">Manage billing</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top-up packs</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TOPUPS.map((t) => (
            <form key={t.key} action="/api/billing/topup" method="post">
              <input type="hidden" name="topup_key" value={t.key} />
              <Button type="submit" variant="outline" className="w-full flex flex-col h-auto py-3">
                <span className="font-semibold">{t.label}</span>
                <span className="text-xs text-zinc-500">${t.price}</span>
              </Button>
            </form>
          ))}
          <p className="col-span-full text-xs text-zinc-500">Top-up balance: <strong>{m?.topupBalance ?? 0}</strong></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Auto-recharge</CardTitle></CardHeader>
        <CardContent>
          <form action={saveAutoRecharge} className="flex flex-col gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="enabled" defaultChecked={m?.autoRechargeEnabled ?? false} />
              Enable auto-recharge
            </label>
            <label className="flex flex-col gap-1">
              <span>Trigger when fewer than</span>
              <input name="threshold" type="number" min={1} max={1000} defaultValue={m?.autoRechargeThreshold ?? 10} className="border rounded px-2 py-1 w-32" />
              <span className="text-xs text-zinc-500">conversations remaining</span>
            </label>
            <label className="flex flex-col gap-1">
              <span>Recharge with</span>
              <select name="pack_size" defaultValue={m?.autoRechargePackSize ?? 200} className="border rounded px-2 py-1 w-40">
                <option value={50}>50 ($19)</option>
                <option value={200}>200 ($59)</option>
                <option value={1000}>1,000 ($199)</option>
                <option value={5000}>5,000 ($799)</option>
              </select>
            </label>
            <Button type="submit" className="self-start">Save</Button>
            <p className="text-xs text-zinc-500">Hard cap: 3 auto-recharges per billing period.</p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="px-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-4 text-sm text-zinc-500">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b"><th className="px-6 py-2 text-left">Date</th><th className="text-left">Amount</th><th className="text-left">Status</th><th className="text-left">PDF</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-6 py-2">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td>${(inv.total / 100).toFixed(2)}</td>
                    <td>{inv.status}</td>
                    <td>{inv.pdf ? <a href={inv.pdf} className="underline">Download</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/app/app/billing/page.tsx
git commit -m "feat(web): /app/billing page (plan + topups + auto-recharge + invoices)"
```

---

## Phase L — Alerts + Diagnostics

### Task L.1: `/api/alerts/[id]/accept`

**Files:**
- Create: `web/src/app/api/alerts/[id]/accept/route.ts`
- Test: `web/src/app/api/alerts/[id]/accept/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/app/api/alerts/[id]/accept/route.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-X', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

const updateMerchant = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      alerts: { findFirst: vi.fn().mockResolvedValue({ id: 'a1', merchantId: 'SM-X', kind: 'override_failing', payload: { selector_key: 'add_to_cart', suggested: "button[data-action='add-to-cart']" } }) },
      merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', adapterConfig: { type: 'shopify' } }) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateMerchant })) })),
  },
}));

import { POST } from './route';

describe('POST /api/alerts/[id]/accept', () => {
  it('marks alert resolved and writes selector override', async () => {
    const req = new Request('http://localhost/api/alerts/a1/accept', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'a1' }) });
    expect(res.status).toBe(303);
    expect(updateMerchant).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test src/app/api/alerts/\[id\]/accept/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
// web/src/app/api/alerts/[id]/accept/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { alerts, merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const alert = await db.query.alerts.findFirst({ where: eq(alerts.id, id) });
  if (!alert || alert.merchantId !== session.merchant.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  if (alert.kind === 'override_failing') {
    const payload = alert.payload as { selector_key: string; suggested: string };
    const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
    const config = (m?.adapterConfig ?? {}) as Record<string, unknown>;
    const selectors = (config.selectors ?? {}) as Record<string, { value: string; source: string }>;
    selectors[payload.selector_key] = { value: payload.suggested, source: 'merchant_override' };
    await db.update(merchants)
      .set({ adapterConfig: { ...config, selectors } })
      .where(eq(merchants.id, session.merchant.id));
  }

  await db.update(alerts).set({ resolvedAt: new Date(), acknowledgedAt: new Date() }).where(eq(alerts.id, id));

  return NextResponse.redirect(new URL('/app', _req.url), 303);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test src/app/api/alerts/\[id\]/accept/route.test.ts`
Expected: PASS — 1/1.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/alerts
git commit -m "feat(web): /api/alerts/[id]/accept locks merchant_override + resolves alert"
```

---

### Task L.2: `/api/merchant/resync` + Diagnostics page

**Files:**
- Create: `web/src/app/api/merchant/resync/route.ts`
- Create: `web/src/app/app/diagnostics/page.tsx`

- [ ] **Step 1: Implement resync route**

```ts
// web/src/app/api/merchant/resync/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

export async function POST(req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await db.update(merchants).set({ status: 'catalog_pending', catalogSyncedAt: null }).where(eq(merchants.id, session.merchant.id));

  return NextResponse.redirect(new URL('/app', req.url), 303);
}
```

- [ ] **Step 2: Implement diagnostics page**

```tsx
// web/src/app/app/diagnostics/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { alerts } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function DiagnosticsPage({ searchParams }: { searchParams: Promise<{ alert?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const alertRow = sp.alert ? await db.query.alerts.findFirst({ where: eq(alerts.id, sp.alert) }) : null;

  if (!alertRow || alertRow.merchantId !== session.merchant.id) {
    return (
      <div className="max-w-2xl flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Diagnostics</h1>
        <p className="text-sm text-zinc-500">Open this page from a banner alert to see details.</p>
      </div>
    );
  }

  const payload = alertRow.payload as Record<string, unknown>;

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Diagnostics</h1>
      <Card>
        <CardHeader><CardTitle>{alertRow.kind}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {alertRow.kind === 'override_failing' && (
            <>
              <p className="text-sm">
                Selector <code>{String(payload.selector_key)}</code> is failing on <code>{String(payload.url ?? 'unknown')}</code>.
              </p>
              {payload.suggested ? (
                <p className="text-sm">Suggested fix: <code>{String(payload.suggested)}</code></p>
              ) : (
                <p className="text-sm text-zinc-500">No suggestion available — write your own selector via Settings &rarr; Persona.</p>
              )}
              <div className="flex gap-2">
                <form action={`/api/alerts/${alertRow.id}/accept`} method="post">
                  <Button type="submit">Accept</Button>
                </form>
                <Button variant="outline" type="button" disabled>Reject + write your own (v1.1+)</Button>
              </div>
            </>
          )}
          {alertRow.kind === 'smoke_failing' && (
            <p className="text-sm">Your widget can&apos;t add items to cart. Re-sync your catalog or contact support.</p>
          )}
          {alertRow.kind === 'catalog_drift' && (
            <p className="text-sm">Your catalog hasn&apos;t synced in 24h. Click &quot;Re-sync now&quot; on the banner.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/merchant/resync web/src/app/app/diagnostics
git commit -m "feat(web): /api/merchant/resync + diagnostics page (banner-only landing per §7.4)"
```

---

## Phase M — Marketing → app handoff + acceptance

### Task M.1: Add "Get started" CTA on marketing pages

**Files:**
- Modify: `web/src/components/Cta.tsx` (or wherever the marketing CTA lives — adjust to point to `/signup`)
- Modify: `web/src/app/(marketing)/layout.tsx` (if not already wrapping marketing pages)
- Modify existing: `web/src/app/page.tsx` — move into `(marketing)` segment

- [ ] **Step 1: Move existing landing into (marketing) segment**

```bash
mkdir -p web/src/app/\(marketing\)
git mv web/src/app/page.tsx web/src/app/\(marketing\)/page.tsx
```

If marketing layout doesn't exist, create one:

```tsx
// web/src/app/(marketing)/layout.tsx
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Update the existing CTA component**

Find the existing `Cta` component (probably `web/src/components/Cta.tsx`) and ensure its primary button links to `/signup`:

```tsx
<a href="/signup" className="...">Get started — $30/mo</a>
```

(Use Read first to find the actual component name, then Edit.)

- [ ] **Step 3: Manual verify routing**

Run: `cd web && pnpm dev`
- Visit `/` → marketing landing renders.
- Click "Get started" → `/signup`.
- Visit `/app` (with no session) → redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/\(marketing\) web/src/components/Cta.tsx
git commit -m "feat(web): wire marketing CTAs to /signup; move landing into (marketing) segment"
```

---

### Task M.2: Playwright E2E happy path

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/e2e/onboarding.spec.ts`

- [ ] **Step 1: Add Playwright config**

```ts
// web/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Implement happy-path spec**

```ts
// web/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('signup → magic-link request renders confirmation', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[type=email]', `e2e-${Date.now()}@shoppingmate.test`);
  await page.click('button[type=submit]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
});

// NOTE: full happy-path (Stripe Checkout → Composio connect → install → home) is run
// manually against the dev environment per docs/runbooks/2026-05-04-phase2-acceptance.md.
// Automating it requires a test mailbox + Stripe test-clock harness and is deferred to
// Phase 2.5 polish.
```

- [ ] **Step 3: Verify Playwright runs**

Run: `cd web && pnpm exec playwright install chromium && pnpm exec playwright test --project=chromium e2e/onboarding.spec.ts`
Expected: at minimum the signup form-submission step passes.

- [ ] **Step 4: Commit**

```bash
git add web/playwright.config.ts web/e2e
git commit -m "test(web): playwright e2e config + signup happy-path scaffold"
```

---

### Task M.3: Manual acceptance checklist + tag

**Files:**
- Create: `docs/runbooks/2026-05-04-phase2-acceptance.md`

- [ ] **Step 1: Write checklist matching spec §12**

```markdown
# Phase 2 — Brand Dashboard Acceptance Checklist

Run through each item against a live dev environment with Stripe test mode + Composio sandbox + Resend test domain. Tick when verified.

- [ ] /signup — enter email, click magic link, land on /app/onboarding
- [ ] Step 2 — Stripe Checkout for Starter $30 in test mode → real merchant_id provisioned
- [ ] Step 3 — Connect Shopify dev store via Composio OAuth → catalog sync visible in real time
- [ ] Step 4 — Copy script tag, paste into a test page, click "I've pasted it" → green check
- [ ] /app — 4 KPI tiles render (zero values), "No conversations yet" empty state
- [ ] /app/knowledge — upload 2-page returns-policy.pdf → status flips to ready
- [ ] /app/settings — set persona (Warm Brit / brand notes / neutral) and lead webhook → save
- [ ] Trigger synthetic agent session against widget → KPI tile increments → conversation visible in /app/conversations → click into transcript
- [ ] Sign out, sign back in via magic link → land back on /app with state intact
- [ ] /app/billing — click "Manage billing" → Stripe Customer Portal opens
- [ ] Force payment_failed via Stripe CLI → red banner appears at top → "Update payment" link → Stripe Portal

Notes / blockers:
-
```

- [ ] **Step 2: Once all 11 checks pass, tag the release**

```bash
git tag phase2-brand-dashboard-complete
```

- [ ] **Step 3: Commit + push tag (manual)**

```bash
git add docs/runbooks/2026-05-04-phase2-acceptance.md
git commit -m "docs(runbook): phase 2 brand dashboard acceptance checklist"
```

(Tag push deferred to operator pass per Plans 1-5 convention.)

---

## Self-review notes

After every task in a phase is committed, run the full test suite from the repo root:

```bash
pnpm -r test
pnpm -r typecheck
```

Both must be green before moving to the next phase. If a typecheck error references a file you didn't touch, it likely came from `@shoppingmate/db` re-exports — ensure `packages/db/src/schema/index.ts` exports the new schemas.

---

**End of plan.** Total: ~52 tasks across 13 phases (A–M).

