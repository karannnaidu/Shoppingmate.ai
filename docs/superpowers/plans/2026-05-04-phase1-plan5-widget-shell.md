# Plan 5 — Voice-First Widget Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `packages/widget/dist/v1.js` — the visitor-facing CDN bundle that renders the floating-pill / call / chat surfaces from `web/src/components/WidgetPreview.tsx`, drives the user end-to-end through Plan 4's agent runtime over WS, and uses browser STT/TTS for voice. ≤120 KB gzip. All tests vitest+happy-dom; manual browser smoke deferred to operator.

**Architecture:** New `packages/widget/` workspace, vanilla TS + Shadow DOM, no React in the bundle. New `POST /v1/session` endpoint mints `{sessionId, wsToken, wsUrl}` so the bundle can connect to the existing `/v1/widget/:sid/agent` WS without exposing the secret. The transcript is a heterogeneous timeline of text bubbles + inline product card rows; cards are tappable and emit the same `card_tap` WS message a voice "add the second one" would.

**Tech Stack:** TypeScript, esbuild (IIFE bundle), vitest + happy-dom, Web Speech API (STT/TTS), DOM Web Components + Shadow DOM. Backend additions in Hono (existing). Zero runtime deps in the bundle.

---

## Phase A — Workspace scaffolding

### Task 1: Create `packages/widget/package.json`

**Files:**
- Create: `packages/widget/package.json`

- [ ] **Step 1: Write the package manifest**

```json
{
  "name": "@shoppingmate/widget",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsx scripts/build.ts",
    "dev": "tsx scripts/build.ts --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.24.0",
    "happy-dom": "^15.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Add to root pnpm-workspace.yaml if not auto-included**

Run: `cat pnpm-workspace.yaml`
If `packages/*` glob is present (it is per existing structure), no edit needed.

- [ ] **Step 3: Run `pnpm install` from repo root to register the new workspace**

Run: `pnpm install`
Expected: "+ N packages" includes the widget workspace; `node_modules/@shoppingmate/widget` symlink appears.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/package.json pnpm-lock.yaml
git commit -m "feat(widget): scaffold @shoppingmate/widget workspace"
```

---

### Task 2: Create `packages/widget/tsconfig.json` and `vitest.config.ts`

**Files:**
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/vitest.config.ts`

- [ ] **Step 1: Write tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "declaration": false,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "test/**/*", "scripts/**/*"]
}
```

- [ ] **Step 2: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Verify typecheck runs (no source files yet, should be a no-op clean)**

Run: `pnpm --filter @shoppingmate/widget typecheck`
Expected: exits 0 with no output, or "No files matched" — both are fine. If error about empty include, add a `src/.gitkeep` empty file.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/tsconfig.json packages/widget/vitest.config.ts
git commit -m "feat(widget): tsconfig + vitest happy-dom config"
```

---

### Task 3: esbuild script + gzip budget assertion

**Files:**
- Create: `packages/widget/scripts/build.ts`
- Create: `packages/widget/src/index.ts` (placeholder)

- [ ] **Step 1: Write the bundle entry placeholder**

`packages/widget/src/index.ts`:
```ts
console.warn('[shoppingmate] widget bundle loaded (placeholder)');
```

- [ ] **Step 2: Write the build script**

`packages/widget/scripts/build.ts`:
```ts
import { gzipSync } from 'node:zlib';
import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUDGET_BYTES = 120 * 1024; // 120 KB gzip

const watch = process.argv.includes('--watch');

const apiBase = process.env.SHOPPINGMATE_API_BASE ?? 'https://api.shoppingmate.ai';

const options = {
  entryPoints: [resolve(import.meta.dirname, '../src/index.ts')],
  outfile: resolve(import.meta.dirname, '../dist/v1.js'),
  bundle: true,
  format: 'iife' as const,
  target: ['es2020'],
  minify: !watch,
  sourcemap: watch ? 'inline' as const : false,
  legalComments: 'none' as const,
  define: {
    'process.env.SHOPPINGMATE_API_BASE': JSON.stringify(apiBase),
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[widget] watching…');
} else {
  await build(options);
  const bytes = readFileSync(options.outfile);
  const gz = gzipSync(bytes).length;
  const pct = ((gz / BUDGET_BYTES) * 100).toFixed(1);
  console.log(`[widget] ${options.outfile}: ${bytes.length} bytes raw, ${gz} bytes gzip (${pct}% of ${BUDGET_BYTES} budget)`);
  if (gz > BUDGET_BYTES) {
    console.error(`[widget] FAIL: bundle exceeds ${BUDGET_BYTES}-byte gzip budget`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Run the build and verify the placeholder bundle compresses**

Run: `pnpm --filter @shoppingmate/widget build`
Expected output ends with: `[widget] dist/v1.js: NNN bytes raw, NN bytes gzip (0.x% of 122880 budget)` — exit 0.

- [ ] **Step 4: Add `dist/` to `.gitignore` for the package**

Edit `.gitignore` (root) — append:
```
packages/widget/dist/
```

- [ ] **Step 5: Commit**

```bash
git add packages/widget/scripts/build.ts packages/widget/src/index.ts .gitignore
git commit -m "feat(widget): esbuild IIFE bundle + 120KB gzip budget gate"
```

---

## Phase B — API surface: POST /v1/session

### Task 4: Failing test for POST /v1/session

**Files:**
- Create: `apps/api/src/routes/session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { Hono } from 'hono';
import { sessionRoute } from './session.js';

vi.mock('@shoppingmate/db', async () => {
  const merchants = [
    {
      id: 'SM-TST001',
      allowedDomains: ['merchant.example.com'],
      status: 'live',
    },
  ];
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => merchants,
          }),
        }),
      }),
    },
    schema: { merchants: { id: 'id', allowedDomains: 'allowedDomains' } },
  };
});

vi.mock('drizzle-orm', () => ({ eq: () => 'eq-stub' }));

const app = new Hono();
app.route('/v1/session', sessionRoute);

describe('POST /v1/session', () => {
  it('returns sessionId, wsToken and wsUrl when origin matches and merchant is allowed', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://merchant.example.com',
        referer: 'https://merchant.example.com/page',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toMatch(/^ws_/);
    expect(body.wsToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(body.wsUrl).toContain('/v1/widget/');
    expect(body.wsUrl).toContain('token=');
  });

  it('rejects when origin does not match domain', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        referer: 'https://attacker.example/',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects unknown merchant', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://merchant.example.com',
        referer: 'https://merchant.example.com/',
      },
      body: JSON.stringify({ merchantId: 'SM-NOPE99', domain: 'merchant.example.com' }),
    });
    expect(res.status).toBe(404);
  });

  it('rejects domain not in merchant allowlist', async () => {
    const res = await app.request('/v1/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://other.example.com',
        referer: 'https://other.example.com/',
      },
      body: JSON.stringify({ merchantId: 'SM-TST001', domain: 'other.example.com' }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `pnpm --filter @shoppingmate/api test -- session.test`
Expected: FAIL — "Cannot find module './session.js'".

---

### Task 5: Implement POST /v1/session

**Files:**
- Create: `apps/api/src/routes/session.ts`

- [ ] **Step 1: Implement the route**

```ts
import { db, schema } from '@shoppingmate/db';
import { signWsToken } from '@shoppingmate/dom-harness';
import { childLogger, env } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { originMatches } from '../lib/originCheck.js';

const log = childLogger({ route: 'session' });

const SessionBody = z.object({
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
  domain: z.string().min(1),
});

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function newSessionId(): string {
  // 22-char base36 — enough entropy for v0.1, no extra deps
  const rand = Math.random().toString(36).slice(2, 12);
  const ts = Date.now().toString(36);
  return `ws_${ts}${rand}`;
}

function wsBaseUrl(): string {
  const apiBase = env.PUBLIC_API_BASE_URL ?? `http://localhost:${env.API_PORT}`;
  return apiBase.replace(/^http/, 'ws');
}

export const sessionRoute = new Hono();

sessionRoute.post('/', async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const parsed = SessionBody.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const body = parsed.data;

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  if (!originMatches(origin, referer, body.domain)) {
    log.info({ merchantId: body.merchantId, origin, referer }, 'session rejected_origin');
    return c.json({ error: 'origin_mismatch', message: 'origin/referer must match domain' }, 403);
  }

  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  if (!merchant) {
    return c.json({ error: 'merchant_not_found', message: 'unknown merchantId' }, 404);
  }

  if (!merchant.allowedDomains.includes(body.domain)) {
    log.warn({ merchantId: body.merchantId, domain: body.domain }, 'session rejected_domain');
    return c.json({ error: 'domain_not_allowed', message: 'domain not in allowlist' }, 403);
  }

  const sessionId = newSessionId();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const wsToken = signWsToken({ sessionId, merchantId: body.merchantId, exp });
  const wsUrl = `${wsBaseUrl()}/v1/widget/${sessionId}/agent?token=${wsToken}`;

  return c.json({ sessionId, wsToken, wsUrl }, 200);
});
```

- [ ] **Step 2: If `env.PUBLIC_API_BASE_URL` doesn't exist, add it to packages/shared env schema**

Run: `grep -n "PUBLIC_API_BASE_URL\|API_PORT" packages/shared/src/env.ts`
If `PUBLIC_API_BASE_URL` is missing, add it as `z.string().optional()` in the env schema.

- [ ] **Step 3: Run the test to confirm pass**

Run: `pnpm --filter @shoppingmate/api test -- session.test`
Expected: 4/4 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/session.ts apps/api/src/routes/session.test.ts packages/shared/src/env.ts
git commit -m "feat(api): POST /v1/session — mint WS token for widget bootstrap"
```

---

### Task 6: Wire /v1/session into apps/api/src/index.ts

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add the import and route registration**

Add to imports near `installRoute`:
```ts
import { sessionRoute } from './routes/session.js';
```

After `app.route('/v1/install', installRoute);` add:
```ts
app.route('/v1/session', sessionRoute);
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @shoppingmate/api typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): mount /v1/session in api server"
```

---

## Phase C — Transport layer

### Task 7: Codec — encode WidgetMessage / decode AgentEvent

**Files:**
- Create: `packages/widget/src/transport/codec.ts`
- Create: `packages/widget/test/transport-codec.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { encodeWidgetMessage, decodeAgentEvent } from '../src/transport/codec.js';

describe('codec', () => {
  it('encodes user_text as JSON', () => {
    const out = encodeWidgetMessage({
      type: 'user_text',
      sessionId: 'ws_abc',
      text: 'hi',
      mode: 'voice',
    });
    expect(JSON.parse(out)).toEqual({
      type: 'user_text',
      sessionId: 'ws_abc',
      text: 'hi',
      mode: 'voice',
    });
  });

  it('encodes card_tap with variantId null when omitted', () => {
    const out = encodeWidgetMessage({
      type: 'card_tap',
      sessionId: 'ws_abc',
      action: 'cartAdd',
      sku: 'SKU-1',
      variantId: null,
      qty: 1,
    });
    expect(JSON.parse(out).variantId).toBeNull();
  });

  it('decodes a say event', () => {
    const ev = decodeAgentEvent(JSON.stringify({ type: 'say', text: 'hello' }));
    expect(ev).toEqual({ type: 'say', text: 'hello' });
  });

  it('decodes a cards event', () => {
    const ev = decodeAgentEvent(
      JSON.stringify({
        type: 'cards',
        items: [
          {
            image: 'https://i/p.jpg',
            title: 'Cream',
            priceFormatted: 'USD 14.99',
            variantId: null,
            sku: 'SKU-1',
            productUrl: 'https://shop/p',
          },
        ],
      }),
    );
    expect(ev?.type).toBe('cards');
    if (ev?.type === 'cards') expect(ev.items).toHaveLength(1);
  });

  it('returns null on malformed JSON', () => {
    expect(decodeAgentEvent('not-json')).toBeNull();
  });

  it('returns null on unknown event type', () => {
    expect(decodeAgentEvent(JSON.stringify({ type: 'mystery' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement codec**

```ts
// Mirrors apps/api/src/agent/types.ts and events.ts. Kept in sync via test-time
// shape parity with the runtime codec; see test/transport-codec-parity.test.ts.

export type Mode = 'voice' | 'text';

export type CardItem = {
  image: string | null;
  title: string;
  priceFormatted: string;
  variantId: string | null;
  sku: string;
  productUrl: string;
  badges?: string[];
};

export type WidgetMessage =
  | { type: 'user_text'; sessionId: string; text: string; mode: Mode }
  | {
      type: 'card_tap';
      sessionId: string;
      action: 'cartAdd';
      variantId: string | null;
      sku: string;
      qty: number;
    }
  | { type: 'session_resume'; sessionId: string }
  | { type: 'session_end'; sessionId: string };

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' };

export function encodeWidgetMessage(msg: WidgetMessage): string {
  return JSON.stringify(msg);
}

export function decodeAgentEvent(raw: string): AgentEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  switch (o.type) {
    case 'thinking':
      return { type: 'thinking' };
    case 'say':
      return typeof o.text === 'string' ? { type: 'say', text: o.text } : null;
    case 'cards':
      return Array.isArray(o.items) ? { type: 'cards', items: o.items as CardItem[] } : null;
    case 'tool_result':
      if (typeof o.toolName !== 'string' || typeof o.ok !== 'boolean') return null;
      return {
        type: 'tool_result',
        toolName: o.toolName,
        ok: o.ok,
        summary: typeof o.summary === 'string' ? o.summary : undefined,
      };
    case 'checkout_redirect':
      return typeof o.url === 'string' ? { type: 'checkout_redirect', url: o.url } : null;
    case 'cap_warning':
      if (
        (o.reason !== 'turns' && o.reason !== 'voice_ms' && o.reason !== 'duration_ms') ||
        typeof o.remaining !== 'number'
      )
        return null;
      return { type: 'cap_warning', reason: o.reason, remaining: o.remaining };
    case 'end_of_turn':
      return { type: 'end_of_turn' };
    case 'session_closed':
      if (o.reason !== 'user' && o.reason !== 'cap' && o.reason !== 'error') return null;
      return { type: 'session_closed', reason: o.reason };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/transport/codec.ts packages/widget/test/transport-codec.test.ts
git commit -m "feat(widget): transport codec — encode WidgetMessage / decode AgentEvent"
```

---

### Task 8: WS client with reconnect

**Files:**
- Create: `packages/widget/src/transport/ws.ts`
- Create: `packages/widget/test/transport-ws.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAgentWs, type AgentSocket } from '../src/transport/ws.js';

class MockWs {
  static instances: MockWs[] = [];
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) {
    MockWs.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  message(s: string) {
    this.onmessage?.(new MessageEvent('message', { data: s }));
  }
  fail() {
    this.onerror?.(new Event('error'));
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
}

beforeEach(() => {
  MockWs.instances = [];
  vi.stubGlobal('WebSocket', MockWs);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('connectAgentWs', () => {
  it('opens with the supplied URL and forwards events', async () => {
    const events: string[] = [];
    const sock: AgentSocket = connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: (raw) => events.push(raw),
      onStatus: () => {},
    });
    expect(MockWs.instances).toHaveLength(1);
    MockWs.instances[0]!.open();
    MockWs.instances[0]!.message('{"type":"say","text":"hi"}');
    expect(events).toEqual(['{"type":"say","text":"hi"}']);
    sock.close();
  });

  it('reconnects with exponential backoff and sends session_resume on reconnect', async () => {
    const statuses: string[] = [];
    const sock = connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
    });
    MockWs.instances[0]!.open();
    statuses.length = 0;
    MockWs.instances[0]!.fail();
    expect(statuses).toContain('reconnecting');
    // first backoff: 1s
    vi.advanceTimersByTime(1000);
    expect(MockWs.instances).toHaveLength(2);
    MockWs.instances[1]!.open();
    expect(MockWs.instances[1]!.sent[0]).toBe(
      JSON.stringify({ type: 'session_resume', sessionId: 'ws_a' }),
    );
    sock.close();
  });

  it('gives up after 5 failures', async () => {
    const statuses: string[] = [];
    connectAgentWs('wss://api/test', {
      sessionId: 'ws_a',
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
    });
    for (let i = 0; i < 5; i += 1) {
      MockWs.instances.at(-1)!.fail();
      vi.advanceTimersByTime(60_000);
    }
    expect(statuses).toContain('disconnected');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ws.ts**

```ts
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type AgentSocketDeps = {
  sessionId: string;
  onEvent: (raw: string) => void;
  onStatus: (s: ConnectionStatus) => void;
};

export type AgentSocket = {
  send: (encoded: string) => void;
  close: () => void;
};

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_FAILURES = 5;

export function connectAgentWs(url: string, deps: AgentSocketDeps): AgentSocket {
  let ws: WebSocket | null = null;
  let failures = 0;
  let stopped = false;
  let pending: string[] = [];

  function open() {
    if (stopped) return;
    deps.onStatus(failures > 0 ? 'reconnecting' : 'connecting');
    ws = new WebSocket(url);
    ws.onopen = () => {
      deps.onStatus('connected');
      // Resume on every (re)connect after the first; the server treats the
      // first user_text frame on a fresh session as the start of a new turn,
      // so resume is only meaningful when reconnecting.
      if (failures > 0) {
        ws?.send(JSON.stringify({ type: 'session_resume', sessionId: deps.sessionId }));
      }
      failures = 0;
      for (const m of pending) ws?.send(m);
      pending = [];
    };
    ws.onmessage = (ev) => deps.onEvent(typeof ev.data === 'string' ? ev.data : '');
    ws.onerror = () => {
      // onclose fires too; backoff scheduled there.
    };
    ws.onclose = () => {
      if (stopped) return;
      failures += 1;
      if (failures > MAX_FAILURES) {
        deps.onStatus('disconnected');
        return;
      }
      const delay = BACKOFF_SCHEDULE_MS[Math.min(failures - 1, BACKOFF_SCHEDULE_MS.length - 1)] ?? 30000;
      deps.onStatus('reconnecting');
      setTimeout(open, delay);
    };
  }

  open();

  return {
    send: (encoded) => {
      if (ws && ws.readyState === 1) ws.send(encoded);
      else pending.push(encoded);
    },
    close: () => {
      stopped = true;
      ws?.close();
    },
  };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 9/9 PASS (3 new + 6 prior).

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/transport/ws.ts packages/widget/test/transport-ws.test.ts
git commit -m "feat(widget): reconnecting WS client with session_resume + backoff"
```

---

## Phase D — Audio layer

### Task 9: STT wrapper

**Files:**
- Create: `packages/widget/src/audio/stt.ts`
- Create: `packages/widget/test/audio-stt.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSTT, type STT } from '../src/audio/stt.js';

class FakeRecognition {
  static lastInstance: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onresult: ((ev: { results: { 0: { 0: { transcript: string } }; isFinal: boolean }[] }) => void) | null = null;
  onerror: ((ev: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRecognition.lastInstance = this;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; this.onend?.(); }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSTT', () => {
  it('returns null when SpeechRecognition is unavailable', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    expect(createSTT()).toBeNull();
  });

  it('uses webkitSpeechRecognition fallback', () => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const stt = createSTT();
    expect(stt).not.toBeNull();
  });

  it('emits final transcripts via onFinal', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const finals: string[] = [];
    const stt = createSTT()!;
    stt.onFinal((t) => finals.push(t));
    stt.start();
    FakeRecognition.lastInstance!.onresult?.({
      results: [{ 0: { 0: { transcript: 'hello there' } }, isFinal: true } as any],
    } as any);
    expect(finals).toEqual(['hello there']);
  });

  it('start/stop are idempotent', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    const stt = createSTT()!;
    stt.start();
    stt.start();
    expect(FakeRecognition.lastInstance!.started).toBe(true);
    stt.stop();
    stt.stop();
    expect(FakeRecognition.lastInstance!.stopped).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement stt.ts**

```ts
type Listener<T> = (v: T) => void;

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export type STT = {
  start: () => void;
  stop: () => void;
  onFinal: (cb: Listener<string>) => void;
  onError: (cb: Listener<string>) => void;
  isActive: () => boolean;
};

export function createSTT(): STT | null {
  const Ctor = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  let active = false;
  const finalListeners: Listener<string>[] = [];
  const errorListeners: Listener<string>[] = [];

  rec.onresult = (ev: any) => {
    for (let i = 0; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      if (r.isFinal) {
        const text = r[0]?.transcript?.trim();
        if (text) for (const cb of finalListeners) cb(text);
      }
    }
  };
  rec.onerror = (ev: any) => {
    for (const cb of errorListeners) cb(String(ev.error ?? 'unknown'));
  };
  rec.onend = () => {
    active = false;
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      try {
        rec.start();
      } catch {
        // already started — webkit throws InvalidStateError; ignore
      }
    },
    stop: () => {
      if (!active) return;
      active = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    onFinal: (cb) => {
      finalListeners.push(cb);
    },
    onError: (cb) => {
      errorListeners.push(cb);
    },
    isActive: () => active,
  };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 13/13 PASS (4 new + 9 prior).

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/audio/stt.ts packages/widget/test/audio-stt.test.ts
git commit -m "feat(widget): SpeechRecognition wrapper with webkit fallback"
```

---

### Task 10: TTS wrapper + voiceMode coordinator

**Files:**
- Create: `packages/widget/src/audio/tts.ts`
- Create: `packages/widget/src/audio/voiceMode.ts`
- Create: `packages/widget/test/audio-voicemode.test.ts`

- [ ] **Step 1: Implement tts.ts**

```ts
export type TTS = {
  speak: (text: string) => Promise<void>;
  cancel: () => void;
  available: () => boolean;
};

export function createTTS(): TTS {
  const synth = (globalThis as any).speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) {
    return { speak: async () => {}, cancel: () => {}, available: () => false };
  }
  function pickVoice(): SpeechSynthesisVoice | null {
    const voices = synth!.getVoices();
    return voices.find((v) => v.lang.startsWith('en-') && v.default) ??
      voices.find((v) => v.lang.startsWith('en-')) ??
      voices[0] ??
      null;
  }
  return {
    speak: (text) =>
      new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.rate = 1.0;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      }),
    cancel: () => synth.cancel(),
    available: () => true,
  };
}
```

- [ ] **Step 2: Implement voiceMode.ts**

```ts
import type { STT } from './stt.js';
import type { TTS } from './tts.js';

export type VoiceModeState = 'idle' | 'listening' | 'speaking' | 'muted';

export type VoiceMode = {
  start: () => void;
  stop: () => void;
  speak: (text: string) => Promise<void>;
  setMuted: (m: boolean) => void;
  getState: () => VoiceModeState;
  onStateChange: (cb: (s: VoiceModeState) => void) => void;
};

export function createVoiceMode(stt: STT | null, tts: TTS): VoiceMode {
  let state: VoiceModeState = 'idle';
  let muted = false;
  const listeners: ((s: VoiceModeState) => void)[] = [];
  const set = (s: VoiceModeState) => {
    if (state === s) return;
    state = s;
    for (const cb of listeners) cb(s);
  };
  return {
    start: () => {
      if (state !== 'idle') return;
      if (muted) {
        set('muted');
        return;
      }
      stt?.start();
      set('listening');
    },
    stop: () => {
      stt?.stop();
      tts.cancel();
      set('idle');
    },
    speak: async (text) => {
      if (state === 'idle') return;
      stt?.stop();
      set('speaking');
      await tts.speak(text);
      if (state !== 'idle' && !muted) {
        stt?.start();
        set('listening');
      } else if (muted) {
        set('muted');
      }
    },
    setMuted: (m) => {
      muted = m;
      if (m) {
        stt?.stop();
        if (state === 'listening') set('muted');
      } else if (state === 'muted') {
        stt?.start();
        set('listening');
      }
    },
    getState: () => state,
    onStateChange: (cb) => {
      listeners.push(cb);
    },
  };
}
```

- [ ] **Step 3: Write tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createVoiceMode } from '../src/audio/voiceMode.js';
import type { STT } from '../src/audio/stt.js';
import type { TTS } from '../src/audio/tts.js';

function fakeSTT(): STT & { startCalls: number; stopCalls: number } {
  let startCalls = 0;
  let stopCalls = 0;
  return {
    start: () => {
      startCalls += 1;
    },
    stop: () => {
      stopCalls += 1;
    },
    onFinal: () => {},
    onError: () => {},
    isActive: () => false,
    get startCalls() {
      return startCalls;
    },
    get stopCalls() {
      return stopCalls;
    },
  } as STT & { startCalls: number; stopCalls: number };
}

function fakeTTS(): TTS & { spoke: string[] } {
  const spoke: string[] = [];
  return {
    speak: async (t) => {
      spoke.push(t);
    },
    cancel: () => {},
    available: () => true,
    spoke,
  };
}

describe('voiceMode', () => {
  it('start moves idle → listening and starts STT', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    expect(vm.getState()).toBe('listening');
    expect(stt.startCalls).toBe(1);
  });

  it('speak pauses STT during TTS and resumes after', async () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    await vm.speak('hello');
    expect(stt.stopCalls).toBe(1);
    expect(stt.startCalls).toBe(2);
    expect(vm.getState()).toBe('listening');
  });

  it('mute stops STT and prevents listening', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.setMuted(true);
    expect(vm.getState()).toBe('muted');
    expect(stt.stopCalls).toBeGreaterThan(0);
  });

  it('unmute returns to listening', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.setMuted(true);
    vm.setMuted(false);
    expect(vm.getState()).toBe('listening');
  });

  it('stop returns to idle and clears TTS', () => {
    const stt = fakeSTT();
    const vm = createVoiceMode(stt, fakeTTS());
    vm.start();
    vm.stop();
    expect(vm.getState()).toBe('idle');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 18/18 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/audio/tts.ts packages/widget/src/audio/voiceMode.ts packages/widget/test/audio-voicemode.test.ts
git commit -m "feat(widget): half-duplex voice coordinator (STT pause during TTS)"
```

---

## Phase E — State store

### Task 11: Pub/sub store + transcript reducer

**Files:**
- Create: `packages/widget/src/state/store.ts`
- Create: `packages/widget/test/state-store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { createStore } from '../src/state/store.js';

describe('store reducer', () => {
  it('appends user_text on local input', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'user_input', text: 'hi', mode: 'text' });
    expect(s.get().transcript).toEqual([
      expect.objectContaining({ role: 'user', kind: 'text', text: 'hi' }),
    ]);
  });

  it('appends agent text bubble per say event', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'hello' } });
    s.dispatch({ type: 'agent_event', event: { type: 'say', text: 'how can I help?' } });
    expect(s.get().transcript).toHaveLength(2);
    expect(s.get().transcript.every((i) => i.role === 'agent' && i.kind === 'text')).toBe(true);
  });

  it('appends inline cards row', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({
      type: 'agent_event',
      event: {
        type: 'cards',
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10.00',
            variantId: null,
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
    });
    const last = s.get().transcript[0]!;
    expect(last.kind).toBe('cards');
  });

  it('checkout_redirect sets checkoutUrl, no transcript change', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({
      type: 'agent_event',
      event: { type: 'checkout_redirect', url: 'https://shop/checkout' },
    });
    expect(s.get().checkoutUrl).toBe('https://shop/checkout');
    expect(s.get().transcript).toHaveLength(0);
  });

  it('session_closed disables input', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'agent_event', event: { type: 'session_closed', reason: 'cap' } });
    expect(s.get().closed).toBe(true);
    expect(s.get().closedReason).toBe('cap');
  });

  it('subscribe is invoked on every dispatch', () => {
    const s = createStore({ sessionId: 'ws_a' });
    let count = 0;
    s.subscribe(() => {
      count += 1;
    });
    s.dispatch({ type: 'user_input', text: 'a', mode: 'text' });
    s.dispatch({ type: 'agent_event', event: { type: 'thinking' } });
    expect(count).toBe(2);
  });

  it('reset replaces transcript (used on session_resume replay)', () => {
    const s = createStore({ sessionId: 'ws_a' });
    s.dispatch({ type: 'user_input', text: 'hi', mode: 'text' });
    s.dispatch({ type: 'reset' });
    expect(s.get().transcript).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: FAIL.

- [ ] **Step 3: Implement store.ts**

```ts
import type { AgentEvent, CardItem, Mode } from '../transport/codec.js';

export type TranscriptItem =
  | { id: string; role: 'agent'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'user'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'agent'; kind: 'cards'; items: CardItem[]; ts: number }
  | { id: string; role: 'system'; kind: 'cap_warning'; remaining: number; ts: number }
  | { id: string; role: 'system'; kind: 'closed'; reason: 'user' | 'cap' | 'error'; ts: number };

export type WidgetState = {
  sessionId: string;
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  voiceState: 'idle' | 'listening' | 'speaking' | 'muted';
  transcript: TranscriptItem[];
  thinking: boolean;
  closed: boolean;
  closedReason: 'user' | 'cap' | 'error' | null;
  checkoutUrl: string | null;
  capWarning: { reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number } | null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
};

export type Action =
  | { type: 'set_mode'; mode: WidgetState['mode'] }
  | { type: 'set_voice_state'; state: WidgetState['voiceState'] }
  | { type: 'set_connection'; status: WidgetState['connection'] }
  | { type: 'user_input'; text: string; mode: Mode }
  | { type: 'agent_event'; event: AgentEvent }
  | { type: 'reset' };

export type Store = {
  get: () => WidgetState;
  dispatch: (a: Action) => void;
  subscribe: (cb: (s: WidgetState) => void) => () => void;
};

let idCounter = 0;
const nextId = () => `t${(idCounter += 1)}`;

function reduce(state: WidgetState, a: Action): WidgetState {
  switch (a.type) {
    case 'set_mode':
      return { ...state, mode: a.mode };
    case 'set_voice_state':
      return { ...state, voiceState: a.state };
    case 'set_connection':
      return { ...state, connection: a.status };
    case 'reset':
      return {
        ...state,
        transcript: [],
        thinking: false,
        closed: false,
        closedReason: null,
        checkoutUrl: null,
        capWarning: null,
      };
    case 'user_input':
      return {
        ...state,
        transcript: [
          ...state.transcript,
          { id: nextId(), role: 'user', kind: 'text', text: a.text, ts: Date.now() },
        ],
      };
    case 'agent_event': {
      const ev = a.event;
      switch (ev.type) {
        case 'thinking':
          return { ...state, thinking: true };
        case 'end_of_turn':
          return { ...state, thinking: false };
        case 'say':
          return {
            ...state,
            thinking: false,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'agent', kind: 'text', text: ev.text, ts: Date.now() },
            ],
          };
        case 'cards':
          return {
            ...state,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'agent', kind: 'cards', items: ev.items, ts: Date.now() },
            ],
          };
        case 'tool_result':
          return state;
        case 'checkout_redirect':
          return { ...state, checkoutUrl: ev.url };
        case 'cap_warning':
          return {
            ...state,
            capWarning: { reason: ev.reason, remaining: ev.remaining },
            transcript: [
              ...state.transcript,
              {
                id: nextId(),
                role: 'system',
                kind: 'cap_warning',
                remaining: ev.remaining,
                ts: Date.now(),
              },
            ],
          };
        case 'session_closed':
          return {
            ...state,
            closed: true,
            closedReason: ev.reason,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'system', kind: 'closed', reason: ev.reason, ts: Date.now() },
            ],
          };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

export function createStore(opts: { sessionId: string }): Store {
  let state: WidgetState = {
    sessionId: opts.sessionId,
    mode: 'pill',
    voiceState: 'idle',
    transcript: [],
    thinking: false,
    closed: false,
    closedReason: null,
    checkoutUrl: null,
    capWarning: null,
    connection: 'connecting',
  };
  const subs: ((s: WidgetState) => void)[] = [];
  return {
    get: () => state,
    dispatch: (a) => {
      state = reduce(state, a);
      for (const cb of subs) cb(state);
    },
    subscribe: (cb) => {
      subs.push(cb);
      return () => {
        const i = subs.indexOf(cb);
        if (i >= 0) subs.splice(i, 1);
      };
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 25/25 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/state/store.ts packages/widget/test/state-store.test.ts
git commit -m "feat(widget): pub/sub store with transcript reducer"
```

---

## Phase F — UI primitives

### Task 12: Strings + shadow CSS

**Files:**
- Create: `packages/widget/src/strings.ts`
- Create: `packages/widget/src/styles/shadow.css.ts`

- [ ] **Step 1: Write strings.ts**

```ts
export const STRINGS = {
  pillCallable: 'Talk to Sage',
  pillTextOnly: 'Chat with Sage',
  pillCollapsed: 'Sage',
  callBtn: 'CALL',
  callBtnEnd: 'END',
  chatBtnAria: 'Open text chat',
  callBtnAria: 'Start voice call',
  endCallAria: 'End call',
  closeAria: 'Close',
  callHeaderSpeaking: 'speaking',
  callHeaderListening: 'listening',
  chatHeaderSubtitle: 'text fallback · voice preferred',
  chatPlaceholder: 'Type a quick question…',
  chatGreeting: "Hi, I'm Sage. What are you shopping for today?",
  reconnecting: 'Reconnecting…',
  disconnected: 'Connection lost — reload to retry',
  closed: { user: 'Conversation ended', cap: 'Time to wrap up — reload for a new chat', error: 'Something went wrong' },
  payNow: 'Pay now →',
  capWarning: 'A couple minutes left',
  thinking: 'Sage is thinking…',
  micDenied: 'Mic blocked — switching to text',
} as const;
```

- [ ] **Step 2: Write shadow.css.ts (CSS as a string template)**

`packages/widget/src/styles/shadow.css.ts`:
```ts
export const SHADOW_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}
.root > * { pointer-events: auto; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #09090b;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9999px;
  padding: 6px 8px 6px 6px;
  box-shadow: 0 18px 40px -12px rgba(124,58,237,0.45), 0 8px 20px -8px rgba(0,0,0,0.5);
  cursor: pointer;
}
.avatar {
  width: 40px; height: 40px; border-radius: 9999px; display: grid; place-items: center;
  background: linear-gradient(135deg, #7c3aed, #d946ef, #06b6d4);
  font-weight: 600; font-size: 14px;
  position: relative;
}
.avatar::after {
  content: ""; position: absolute; bottom: 0; right: 0;
  width: 12px; height: 12px; border-radius: 9999px;
  background: #34d399; box-shadow: 0 0 0 2px #09090b;
}
.pill .label { display: flex; flex-direction: column; line-height: 1.1; padding-right: 4px; text-align: left; }
.pill .label-main { font-size: 13px; font-weight: 500; }
.pill .label-sub { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.55); font-family: ui-monospace, monospace; }
.actions { display: flex; align-items: center; gap: 4px; margin-left: 4px; }
.btn {
  border: none; cursor: pointer; font: inherit; color: #fff;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 9999px; padding: 8px 16px; font-size: 12px; font-weight: 600;
  background: linear-gradient(90deg, #7c3aed, #d946ef, #06b6d4);
  box-shadow: 0 6px 18px -4px rgba(217,70,239,0.55);
}
.btn-end { background: #f43f5e; box-shadow: none; }
.btn-icon { background: rgba(255,255,255,0.05); width: 36px; height: 36px; padding: 0; justify-content: center; }
.btn-icon:hover { background: rgba(255,255,255,0.1); }

.panel {
  width: min(380px, calc(100vw - 40px));
  background: #fff; color: #18181b;
  border: 1px solid #e4e4e7; border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 48px -12px rgba(0,0,0,0.25);
  display: flex; flex-direction: column;
}
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e4e4e7; }
.panel-header .who { display: flex; align-items: center; gap: 10px; }
.panel-header .who .name { font-size: 14px; font-weight: 500; }
.panel-header .who .sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: #71717a; font-family: ui-monospace, monospace; }
.elapsed { font-family: ui-monospace, monospace; font-size: 11px; color: #71717a; }

.waveform { display: flex; align-items: center; justify-content: center; gap: 4px; height: 80px; padding: 24px 20px 8px; }
.waveform .bar { width: 3px; border-radius: 2px; background: linear-gradient(180deg, #7c3aed, #d946ef, #06b6d4); height: 10%; transition: height 0.2s; }
.waveform.active .bar { animation: bar 0.8s ease-in-out infinite; }
@keyframes bar { 0%,100% { height: 12%; } 50% { height: var(--peak, 60%); } }
.waveform .bar:nth-child(2n) { --peak: 70%; }
.waveform .bar:nth-child(3n) { --peak: 45%; }
.waveform .bar:nth-child(5n) { --peak: 80%; }
.waveform .bar:nth-child(7n) { --peak: 35%; }

.transcript { display: grid; gap: 8px; padding: 12px 20px; max-height: 220px; overflow-y: auto; }
.bubble { max-width: 85%; padding: 8px 14px; border-radius: 16px; font-size: 13px; line-height: 1.4; }
.bubble.agent { align-self: flex-start; background: #18181b; color: #fafafa; border-bottom-left-radius: 6px; }
.bubble.user { align-self: flex-end; background: #fff; color: #18181b; border: 1px solid #e4e4e7; border-bottom-right-radius: 6px; }
.bubble.system { align-self: center; background: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 12px; border-radius: 9999px; }

.cards-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px; scrollbar-width: thin; }
.card { flex: 0 0 200px; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 8px; cursor: pointer; transition: transform 0.15s; }
.card:hover { transform: translateY(-2px); border-color: #7c3aed; }
.card img { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; background: #f4f4f5; }
.card .title { font-size: 13px; font-weight: 500; margin: 6px 0 2px; }
.card .price { font-size: 12px; color: #71717a; }

.controls { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 16px 20px; border-top: 1px solid #e4e4e7; background: #fafafa; }
.ctrl { width: 48px; height: 48px; border-radius: 9999px; border: 1px solid #e4e4e7; background: #fff; display: grid; place-items: center; cursor: pointer; }
.ctrl.muted { border-color: rgba(244,63,94,0.4); background: rgba(244,63,94,0.1); color: #f43f5e; }
.ctrl.end { width: 56px; height: 56px; background: #f43f5e; color: #fff; border: none; }

.input-row { display: flex; align-items: center; gap: 8px; padding: 10px; border-top: 1px solid #e4e4e7; }
.input-row input { flex: 1; padding: 8px 14px; border: 1px solid #e4e4e7; border-radius: 9999px; font-size: 13px; outline: none; }
.input-row input:focus { border-color: #7c3aed; }
.input-row .send { width: 36px; height: 36px; border-radius: 9999px; background: #18181b; color: #fff; border: none; cursor: pointer; display: grid; place-items: center; }

.checkout-cta {
  display: block; padding: 10px 16px; background: linear-gradient(90deg, #7c3aed, #06b6d4);
  color: #fff; text-align: center; text-decoration: none; font-weight: 600; font-size: 13px;
}
.connection-chip {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  font-size: 10px; padding: 2px 8px; border-radius: 9999px;
  background: rgba(0,0,0,0.6); color: #fff; font-family: ui-monospace, monospace;
}
.hidden { display: none !important; }
`;
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @shoppingmate/widget typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/strings.ts packages/widget/src/styles/shadow.css.ts
git commit -m "feat(widget): strings module + shadow-root CSS"
```

---

### Task 13: Pill renderer

**Files:**
- Create: `packages/widget/src/ui/pill.ts`
- Create: `packages/widget/test/ui-pill.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderPill } from '../src/ui/pill.js';

describe('renderPill', () => {
  it('renders Talk to Sage when callable', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    const onChat = vi.fn();
    renderPill(root, { mode: 'pill', callable: true, onCall, onChat, onClose: () => {} });
    expect(root.textContent).toContain('Talk to Sage');
  });

  it('renders Chat with Sage when not callable', () => {
    const root = document.createElement('div');
    renderPill(root, {
      mode: 'pill',
      callable: false,
      onCall: () => {},
      onChat: () => {},
      onClose: () => {},
    });
    expect(root.textContent).toContain('Chat with Sage');
  });

  it('shows CALL / chat / close actions when expanded', () => {
    const root = document.createElement('div');
    renderPill(root, {
      mode: 'expanded',
      callable: true,
      onCall: () => {},
      onChat: () => {},
      onClose: () => {},
    });
    expect(root.querySelector('[data-action="call"]')).toBeTruthy();
    expect(root.querySelector('[data-action="chat"]')).toBeTruthy();
    expect(root.querySelector('[data-action="close"]')).toBeTruthy();
  });

  it('clicking call invokes onCall', () => {
    const root = document.createElement('div');
    const onCall = vi.fn();
    renderPill(root, {
      mode: 'expanded',
      callable: true,
      onCall,
      onChat: () => {},
      onClose: () => {},
    });
    (root.querySelector('[data-action="call"]') as HTMLButtonElement).click();
    expect(onCall).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Implement pill.ts**

```ts
import { STRINGS } from '../strings.js';

export type PillProps = {
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  callable: boolean;
  onCall: () => void;
  onChat: () => void;
  onClose: () => void;
};

export function renderPill(host: HTMLElement, props: PillProps): void {
  const expanded = props.mode !== 'pill';
  const inCall = props.mode === 'call';
  const inChat = props.mode === 'chat';
  host.innerHTML = `
    <div class="pill" role="region" aria-label="Sage shopping assistant">
      <button class="avatar" data-action="toggle" aria-label="${expanded ? STRINGS.closeAria : STRINGS.pillCollapsed}">S</button>
      <div class="label">
        <span class="label-main">${expanded ? 'Sage' : props.callable ? STRINGS.pillCallable : STRINGS.pillTextOnly}</span>
        <span class="label-sub">AI Assistant</span>
      </div>
      ${
        expanded
          ? `
        <div class="actions">
          ${
            props.callable
              ? `<button class="btn ${inCall ? 'btn-end' : ''}" data-action="call" aria-label="${
                  inCall ? STRINGS.endCallAria : STRINGS.callBtnAria
                }">${inCall ? STRINGS.callBtnEnd : STRINGS.callBtn}</button>`
              : ''
          }
          <button class="btn btn-icon" data-action="chat" aria-pressed="${inChat}" aria-label="${STRINGS.chatBtnAria}">💬</button>
          <button class="btn btn-icon" data-action="close" aria-label="${STRINGS.closeAria}">×</button>
        </div>
      `
          : ''
      }
    </div>
  `;
  host.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
    if (props.mode === 'pill') props.onChat(); // open expanded — caller routes
    else props.onClose();
  });
  host.querySelector('[data-action="call"]')?.addEventListener('click', props.onCall);
  host.querySelector('[data-action="chat"]')?.addEventListener('click', props.onChat);
  host.querySelector('[data-action="close"]')?.addEventListener('click', props.onClose);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 29/29 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/ui/pill.ts packages/widget/test/ui-pill.test.ts
git commit -m "feat(widget): pill renderer (callable + expanded variants)"
```

---

## Phase G — Call panel

### Task 14: Transcript renderer (text + cards inline)

**Files:**
- Create: `packages/widget/src/ui/transcript.ts`
- Create: `packages/widget/test/ui-transcript.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderTranscript } from '../src/ui/transcript.js';
import type { TranscriptItem } from '../src/state/store.js';

describe('renderTranscript', () => {
  it('renders text bubbles and inline cards in order', () => {
    const items: TranscriptItem[] = [
      { id: '1', role: 'agent', kind: 'text', text: 'Hi', ts: 0 },
      {
        id: '2',
        role: 'agent',
        kind: 'cards',
        ts: 1,
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10',
            variantId: null,
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
      { id: '3', role: 'user', kind: 'text', text: 'cool', ts: 2 },
    ];
    const root = document.createElement('div');
    renderTranscript(root, items, () => {});
    const children = Array.from(root.children);
    expect(children).toHaveLength(3);
    expect(children[0]?.classList.contains('bubble')).toBe(true);
    expect(children[1]?.classList.contains('cards-row')).toBe(true);
    expect(children[2]?.classList.contains('bubble')).toBe(true);
  });

  it('clicking a card invokes onCardTap with sku/variantId', () => {
    const tap = vi.fn();
    const items: TranscriptItem[] = [
      {
        id: '2',
        role: 'agent',
        kind: 'cards',
        ts: 1,
        items: [
          {
            image: null,
            title: 'A',
            priceFormatted: 'USD 10',
            variantId: 'V1',
            sku: 'A-1',
            productUrl: 'https://x',
          },
        ],
      },
    ];
    const root = document.createElement('div');
    renderTranscript(root, items, tap);
    (root.querySelector('.card') as HTMLElement).click();
    expect(tap).toHaveBeenCalledWith({ sku: 'A-1', variantId: 'V1' });
  });
});
```

- [ ] **Step 2: Implement transcript.ts**

```ts
import type { CardItem } from '../transport/codec.js';
import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function cardEl(c: CardItem, onTap: (p: { sku: string; variantId: string | null }) => void): HTMLElement {
  const el = document.createElement('button');
  el.className = 'card';
  el.type = 'button';
  el.dataset.sku = c.sku;
  el.innerHTML = `
    ${c.image ? `<img src="${escape(c.image)}" alt="${escape(c.title)}" />` : `<div class="card-img-fallback"></div>`}
    <div class="title">${escape(c.title)}</div>
    <div class="price">${escape(c.priceFormatted)}</div>
  `;
  el.addEventListener('click', () => onTap({ sku: c.sku, variantId: c.variantId }));
  return el;
}

export function renderTranscript(
  host: HTMLElement,
  items: TranscriptItem[],
  onCardTap: (p: { sku: string; variantId: string | null }) => void,
): void {
  host.innerHTML = '';
  for (const item of items) {
    if (item.kind === 'text') {
      const div = document.createElement('div');
      div.className = `bubble ${item.role}`;
      div.textContent = item.text;
      host.appendChild(div);
    } else if (item.kind === 'cards') {
      const row = document.createElement('div');
      row.className = 'cards-row';
      for (const c of item.items) row.appendChild(cardEl(c, onCardTap));
      host.appendChild(row);
    } else if (item.kind === 'cap_warning') {
      const div = document.createElement('div');
      div.className = 'bubble system';
      div.textContent = STRINGS.capWarning;
      host.appendChild(div);
    } else if (item.kind === 'closed') {
      const div = document.createElement('div');
      div.className = 'bubble system';
      div.textContent = STRINGS.closed[item.reason];
      host.appendChild(div);
    }
  }
  host.scrollTop = host.scrollHeight;
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 31/31 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/ui/transcript.ts packages/widget/test/ui-transcript.test.ts
git commit -m "feat(widget): heterogeneous transcript renderer (text + inline cards)"
```

---

### Task 15: Call panel composite

**Files:**
- Create: `packages/widget/src/ui/call.ts`
- Create: `packages/widget/test/ui-call.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderCall } from '../src/ui/call.js';

describe('renderCall', () => {
  it('renders header, waveform, transcript, controls', () => {
    const root = document.createElement('div');
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: null,
      onMute: () => {},
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    expect(root.querySelector('.panel-header')).toBeTruthy();
    expect(root.querySelector('.waveform')).toBeTruthy();
    expect(root.querySelector('.transcript')).toBeTruthy();
    expect(root.querySelector('.controls')).toBeTruthy();
  });

  it('shows checkout CTA when checkoutUrl is set', () => {
    const root = document.createElement('div');
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: 'https://shop/checkout',
      onMute: () => {},
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    const cta = root.querySelector('.checkout-cta') as HTMLAnchorElement;
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('https://shop/checkout');
  });

  it('mute click invokes onMute with toggled value', () => {
    const root = document.createElement('div');
    const onMute = vi.fn();
    renderCall(root, {
      voiceState: 'listening',
      muted: false,
      transcript: [],
      checkoutUrl: null,
      onMute,
      onEnd: () => {},
      onChat: () => {},
      onCardTap: () => {},
      onCheckout: () => {},
    });
    (root.querySelector('[data-action="mute"]') as HTMLElement).click();
    expect(onMute).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Implement call.ts**

```ts
import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';
import { renderTranscript } from './transcript.js';

export type CallProps = {
  voiceState: 'idle' | 'listening' | 'speaking' | 'muted';
  muted: boolean;
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  onMute: (next: boolean) => void;
  onEnd: () => void;
  onChat: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  onCheckout: () => void;
};

export function renderCall(host: HTMLElement, props: CallProps): void {
  const speaking = props.voiceState === 'speaking';
  const subText = props.muted
    ? "you're muted"
    : speaking
    ? `Sage is ${STRINGS.callHeaderSpeaking}…`
    : `${STRINGS.callHeaderListening} to you…`;
  host.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">on call · ${speaking ? STRINGS.callHeaderSpeaking : STRINGS.callHeaderListening}</div>
          </div>
        </div>
      </div>
      <div class="waveform ${speaking && !props.muted ? 'active' : ''}">
        ${Array.from({ length: 28 }).map(() => '<span class="bar"></span>').join('')}
      </div>
      <div class="status-line">${subText}</div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" data-action="checkout" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <div class="controls">
        <button class="ctrl ${props.muted ? 'muted' : ''}" data-action="mute" aria-pressed="${props.muted}" aria-label="${props.muted ? 'Unmute' : 'Mute'}">${props.muted ? '🔇' : '🎤'}</button>
        <button class="ctrl end" data-action="end" aria-label="${STRINGS.endCallAria}">📵</button>
        <button class="ctrl" data-action="chat" aria-label="${STRINGS.chatBtnAria}">💬</button>
      </div>
    </div>
  `;
  const transcriptHost = host.querySelector('[data-region="transcript"]') as HTMLElement;
  renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  host.querySelector('[data-action="mute"]')?.addEventListener('click', () => props.onMute(!props.muted));
  host.querySelector('[data-action="end"]')?.addEventListener('click', props.onEnd);
  host.querySelector('[data-action="chat"]')?.addEventListener('click', props.onChat);
  host.querySelector('[data-action="checkout"]')?.addEventListener('click', props.onCheckout);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 34/34 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/ui/call.ts packages/widget/test/ui-call.test.ts
git commit -m "feat(widget): call panel composite — header + waveform + transcript + controls"
```

---

## Phase H — Chat panel

### Task 16: Chat panel composite

**Files:**
- Create: `packages/widget/src/ui/chat.ts`
- Create: `packages/widget/test/ui-chat.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderChat } from '../src/ui/chat.js';

describe('renderChat', () => {
  it('renders header, transcript, input row', () => {
    const root = document.createElement('div');
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend: () => {},
      onCall: () => {},
      onCardTap: () => {},
      closed: false,
    });
    expect(root.querySelector('.panel-header')).toBeTruthy();
    expect(root.querySelector('.transcript')).toBeTruthy();
    expect(root.querySelector('.input-row input')).toBeTruthy();
  });

  it('submits via Enter and clears input', () => {
    const root = document.createElement('div');
    const onSend = vi.fn();
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend,
      onCall: () => {},
      onCardTap: () => {},
      closed: false,
    });
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = 'hi';
    const form = root.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onSend).toHaveBeenCalledWith('hi');
    expect(input.value).toBe('');
  });

  it('disables input when closed', () => {
    const root = document.createElement('div');
    renderChat(root, {
      transcript: [],
      checkoutUrl: null,
      onSend: () => {},
      onCall: () => {},
      onCardTap: () => {},
      closed: true,
    });
    expect((root.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Implement chat.ts**

```ts
import { STRINGS } from '../strings.js';
import type { TranscriptItem } from '../state/store.js';
import { renderTranscript } from './transcript.js';

export type ChatProps = {
  transcript: TranscriptItem[];
  checkoutUrl: string | null;
  onSend: (text: string) => void;
  onCall: () => void;
  onCardTap: (p: { sku: string; variantId: string | null }) => void;
  closed: boolean;
};

export function renderChat(host: HTMLElement, props: ChatProps): void {
  host.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="who">
          <div class="avatar" aria-hidden="true">S</div>
          <div>
            <div class="name">Sage</div>
            <div class="sub">${STRINGS.chatHeaderSubtitle}</div>
          </div>
        </div>
        <button class="btn" data-action="call" aria-label="${STRINGS.callBtnAria}">${STRINGS.callBtn}</button>
      </div>
      <div class="transcript" data-region="transcript" aria-live="polite"></div>
      ${props.checkoutUrl ? `<a class="checkout-cta" href="${props.checkoutUrl}" target="_blank" rel="noopener">${STRINGS.payNow}</a>` : ''}
      <form class="input-row">
        <input type="text" placeholder="${STRINGS.chatPlaceholder}" ${props.closed ? 'disabled' : ''} />
        <button class="send" type="submit" aria-label="Send" ${props.closed ? 'disabled' : ''}>↵</button>
      </form>
    </div>
  `;
  const transcriptHost = host.querySelector('[data-region="transcript"]') as HTMLElement;
  renderTranscript(transcriptHost, props.transcript, props.onCardTap);
  host.querySelector('[data-action="call"]')?.addEventListener('click', props.onCall);
  const form = host.querySelector('form') as HTMLFormElement;
  const input = host.querySelector('input') as HTMLInputElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    props.onSend(text);
  });
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 37/37 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/ui/chat.ts packages/widget/test/ui-chat.test.ts
git commit -m "feat(widget): chat panel composite — input + transcript + call toggle"
```

---

## Phase I — Bootstrap + Web Component

### Task 17: Bootstrap (install + session mint)

**Files:**
- Create: `packages/widget/src/bootstrap.ts`
- Create: `packages/widget/test/bootstrap.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap, type BootstrapResult } from '../src/bootstrap.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bootstrap', () => {
  it('POSTs install + session and returns wsUrl', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) return new Response(JSON.stringify({ status: 'live' }));
      if (url.endsWith('/v1/session'))
        return new Response(
          JSON.stringify({
            sessionId: 'ws_a',
            wsToken: 'tok',
            wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok',
          }),
        );
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res: BootstrapResult = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.sessionId).toBe('ws_a');
      expect(res.wsUrl).toContain('/v1/widget/ws_a/agent');
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns err when install fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rejected', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('err');
  });
});
```

- [ ] **Step 2: Implement bootstrap.ts**

```ts
export type BootstrapInput = {
  apiBase: string;
  merchantId: string;
  domain: string;
};

export type BootstrapResult =
  | { kind: 'ok'; sessionId: string; wsUrl: string; merchantStatus: string }
  | { kind: 'err'; reason: string };

export async function bootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  try {
    const installRes = await fetch(`${input.apiBase}/v1/install`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantId: input.merchantId,
        domain: input.domain,
        userAgent: navigator.userAgent,
        referrer: document.referrer || null,
      }),
    });
    if (!installRes.ok) return { kind: 'err', reason: `install_${installRes.status}` };
    const installBody = (await installRes.json()) as { status: string };

    const sessionRes = await fetch(`${input.apiBase}/v1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchantId: input.merchantId, domain: input.domain }),
    });
    if (!sessionRes.ok) return { kind: 'err', reason: `session_${sessionRes.status}` };
    const sessionBody = (await sessionRes.json()) as { sessionId: string; wsUrl: string };
    return {
      kind: 'ok',
      sessionId: sessionBody.sessionId,
      wsUrl: sessionBody.wsUrl,
      merchantStatus: installBody.status,
    };
  } catch (err) {
    return { kind: 'err', reason: err instanceof Error ? err.message : 'network' };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 39/39 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/bootstrap.ts packages/widget/test/bootstrap.test.ts
git commit -m "feat(widget): bootstrap — POST /v1/install + /v1/session"
```

---

### Task 18: Web Component shell

**Files:**
- Create: `packages/widget/src/widget.ts`
- Create: `packages/widget/test/widget.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { defineWidget } from '../src/widget.js';

describe('defineWidget', () => {
  it('registers the custom element once', () => {
    defineWidget();
    expect(customElements.get('shoppingmate-widget')).toBeTruthy();
  });

  it('mounts a shadow root with a .root container', () => {
    defineWidget();
    const el = document.createElement('shoppingmate-widget') as HTMLElement & { shadowRoot: ShadowRoot };
    el.setAttribute('data-id', 'SM-TST001');
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.root')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement widget.ts**

```ts
import { bootstrap } from './bootstrap.js';
import { createSTT } from './audio/stt.js';
import { createTTS } from './audio/tts.js';
import { createVoiceMode } from './audio/voiceMode.js';
import { createStore } from './state/store.js';
import { connectAgentWs, type AgentSocket } from './transport/ws.js';
import { decodeAgentEvent, encodeWidgetMessage } from './transport/codec.js';
import { renderCall } from './ui/call.js';
import { renderChat } from './ui/chat.js';
import { renderPill } from './ui/pill.js';
import { SHADOW_CSS } from './styles/shadow.css.js';

const TAG = 'shoppingmate-widget';

class WidgetElement extends HTMLElement {
  private rootEl: HTMLElement | null = null;
  private pillHost: HTMLElement | null = null;
  private panelHost: HTMLElement | null = null;
  private store = createStore({ sessionId: 'pending' });
  private socket: AgentSocket | null = null;
  private voiceMode = createVoiceMode(null, createTTS());
  private apiBase = '';
  private merchantId = '';
  private domain = window.location.host;

  connectedCallback() {
    if (this.shadowRoot) return;
    const id = this.getAttribute('data-id');
    const api = this.getAttribute('data-api') ?? this.apiBase;
    if (!id) {
      console.warn('[shoppingmate] data-id missing on widget element');
      return;
    }
    this.merchantId = id;
    this.apiBase = api;
    const sr = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    sr.appendChild(style);
    const root = document.createElement('div');
    root.className = 'root';
    sr.appendChild(root);
    this.rootEl = root;
    this.panelHost = document.createElement('div');
    this.pillHost = document.createElement('div');
    root.appendChild(this.panelHost);
    root.appendChild(this.pillHost);
    this.store.subscribe(() => this.render());
    this.render();
    void this.start();
  }

  disconnectedCallback() {
    this.socket?.close();
    this.voiceMode.stop();
  }

  private async start() {
    const result = await bootstrap({
      apiBase: this.apiBase,
      merchantId: this.merchantId,
      domain: this.domain,
    });
    if (result.kind === 'err') {
      console.warn('[shoppingmate] bootstrap failed:', result.reason);
      return;
    }
    this.store = createStore({ sessionId: result.sessionId });
    this.store.subscribe(() => this.render());
    const stt = createSTT();
    this.voiceMode = createVoiceMode(stt, createTTS());
    stt?.onFinal((text) => {
      this.store.dispatch({ type: 'user_input', text, mode: 'voice' });
      this.socket?.send(
        encodeWidgetMessage({ type: 'user_text', sessionId: result.sessionId, text, mode: 'voice' }),
      );
    });
    this.voiceMode.onStateChange((s) => this.store.dispatch({ type: 'set_voice_state', state: s }));
    this.socket = connectAgentWs(result.wsUrl, {
      sessionId: result.sessionId,
      onEvent: (raw) => {
        const ev = decodeAgentEvent(raw);
        if (!ev) return;
        this.store.dispatch({ type: 'agent_event', event: ev });
        if (ev.type === 'say') void this.voiceMode.speak(ev.text);
      },
      onStatus: (status) => this.store.dispatch({ type: 'set_connection', status }),
    });
  }

  private render() {
    if (!this.pillHost || !this.panelHost) return;
    const s = this.store.get();
    const callable = createSTT() !== null;
    if (s.mode === 'call') {
      renderCall(this.panelHost, {
        voiceState: s.voiceState,
        muted: s.voiceState === 'muted',
        transcript: s.transcript,
        checkoutUrl: s.checkoutUrl,
        onMute: (next) => this.voiceMode.setMuted(next),
        onEnd: () => {
          this.voiceMode.stop();
          this.store.dispatch({ type: 'set_mode', mode: 'expanded' });
        },
        onChat: () => this.store.dispatch({ type: 'set_mode', mode: 'chat' }),
        onCardTap: (p) => this.cardTap(p),
        onCheckout: () => {},
      });
    } else if (s.mode === 'chat') {
      renderChat(this.panelHost, {
        transcript: s.transcript,
        checkoutUrl: s.checkoutUrl,
        onSend: (text) => this.userText(text, 'text'),
        onCall: () => this.openCall(),
        onCardTap: (p) => this.cardTap(p),
        closed: s.closed,
      });
    } else {
      this.panelHost.innerHTML = '';
    }
    renderPill(this.pillHost, {
      mode: s.mode,
      callable,
      onCall: () => this.openCall(),
      onChat: () => this.store.dispatch({ type: 'set_mode', mode: 'chat' }),
      onClose: () => this.store.dispatch({ type: 'set_mode', mode: 'pill' }),
    });
  }

  private openCall() {
    this.store.dispatch({ type: 'set_mode', mode: 'call' });
    this.voiceMode.start();
  }

  private userText(text: string, mode: 'voice' | 'text') {
    this.store.dispatch({ type: 'user_input', text, mode });
    const sid = this.store.get().sessionId;
    this.socket?.send(encodeWidgetMessage({ type: 'user_text', sessionId: sid, text, mode }));
  }

  private cardTap(p: { sku: string; variantId: string | null }) {
    const sid = this.store.get().sessionId;
    this.socket?.send(
      encodeWidgetMessage({
        type: 'card_tap',
        sessionId: sid,
        action: 'cartAdd',
        sku: p.sku,
        variantId: p.variantId,
        qty: 1,
      }),
    );
  }
}

export function defineWidget(): void {
  if (customElements.get(TAG)) return;
  customElements.define(TAG, WidgetElement);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @shoppingmate/widget test`
Expected: 41/41 PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/widget.ts packages/widget/test/widget.test.ts
git commit -m "feat(widget): <shoppingmate-widget> Web Component — Shadow DOM, mode router"
```

---

### Task 19: Entry script — read data-id, mount once

**Files:**
- Modify: `packages/widget/src/index.ts`

- [ ] **Step 1: Replace placeholder with real entry**

```ts
import { defineWidget } from './widget.js';

declare const process: { env: { SHOPPINGMATE_API_BASE: string } };

function init(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  const merchantId = script?.dataset.id;
  if (!merchantId) {
    console.warn('[shoppingmate] data-id missing on script tag');
    return;
  }
  if (document.querySelector('shoppingmate-widget')) return;
  defineWidget();
  const el = document.createElement('shoppingmate-widget');
  el.setAttribute('data-id', merchantId);
  const apiOverride = script?.dataset.api;
  el.setAttribute('data-api', apiOverride ?? process.env.SHOPPINGMATE_API_BASE);
  if (document.body) document.body.appendChild(el);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), { once: true });
}

init();
```

- [ ] **Step 2: Verify build still passes**

Run: `pnpm --filter @shoppingmate/widget build`
Expected: bundle written, gzip size printed, under budget. Note the size — first real bundle.

- [ ] **Step 3: Commit**

```bash
git add packages/widget/src/index.ts
git commit -m "feat(widget): entry — read data-id, define + mount singleton"
```

---

## Phase J — Acceptance + close

### Task 20: examples/host-page.html + dev script

**Files:**
- Create: `packages/widget/examples/host-page.html`

- [ ] **Step 1: Write the host page**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>shoppingmate widget — local smoke</title>
<style>
  body { font: 14px system-ui; padding: 40px; max-width: 720px; margin: 0 auto; }
  h1 { margin-top: 0; }
  pre { background: #f4f4f5; padding: 12px; border-radius: 8px; overflow-x: auto; }
</style>
</head>
<body>
  <h1>Pretend merchant page</h1>
  <p>This is a local smoke harness for the shoppingmate widget bundle. Open dev tools, talk to Sage in the bottom-right pill.</p>
  <p>Make sure: (a) <code>pnpm --filter @shoppingmate/api dev</code> is running, (b) you've provisioned a dev merchant via <code>pnpm --filter @shoppingmate/cli exec -- shoppingmate provision --domain=localhost --name="Dev Store"</code>, and (c) the merchant id below matches what the CLI printed.</p>
  <pre>SHOPPINGMATE_API_BASE=http://localhost:3000 pnpm --filter @shoppingmate/widget dev</pre>
  <p>Then refresh this page from <code>http://localhost:5174/host-page.html</code> (or wherever you serve it).</p>

  <!-- Replace SM-XXXXXX with the merchantId printed by `provision` -->
  <script async src="../dist/v1.js" data-id="SM-DEV001" data-api="http://localhost:3000"></script>
</body>
</html>
```

- [ ] **Step 2: Add a static-server dev hint to the package.json**

Edit `packages/widget/package.json` — add to scripts:
```json
"serve": "tsx --eval \"import('node:http').then(({createServer}) => import('node:fs').then(({readFileSync}) => createServer((q,s) => { const p = q.url === '/' ? '/host-page.html' : q.url; try { s.end(readFileSync('./examples' + p)); } catch { s.statusCode = 404; s.end(); } }).listen(5174, () => console.log('http://localhost:5174'))))\""
```

(Keep the inline command short; if it's awkward, replace with a 10-line `scripts/serve.ts` file instead.)

- [ ] **Step 3: Verify build + manual smoke is achievable**

Run: `pnpm --filter @shoppingmate/widget build`
Expected: under budget. Document gzip size in the commit message.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/examples/host-page.html packages/widget/package.json
git commit -m "feat(widget): examples/host-page.html + serve script for local smoke"
```

---

### Task 21: Repo-wide acceptance — typecheck, test, lint

**Files:** none (just verify)

- [ ] **Step 1: Run repo-wide typecheck**

Run: `pnpm -r --parallel typecheck`
Expected: clean across all 9 workspaces (8 + new widget).

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: 315 + ~28 new = ~343/343 passing.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: same 4 pre-existing slack-workstream errors. Any new errors must be fixed before tagging.

- [ ] **Step 4: If lint surfaces new widget errors, fix them**

Common ones to expect: noNonNullAssertion in tests (use the same `?? throw` pattern Plan 4 used), or noUnusedTemplateLiteral. Fix in place; commit as `chore(widget): lint cleanup`.

---

### Task 22: Update roadmap + memory + tag

**Files:**
- Modify: `docs/superpowers/roadmap.md`
- Modify: memory `project_shoppingmate_phase1_status.md`

- [ ] **Step 1: Update roadmap §9 Plan 5 row to ✅ Complete with commit references**

Replace the existing Plan 5 row in the "Phase 1 closing plans" table with a row similar to Plan 4's:
```
| Plan 5 — Voice-first widget shell | ✅ Complete | XX tasks across 10 phases (A-J), commits `<first>`…`<last>`. Vanilla TS + Shadow DOM bundle in `packages/widget/`, 7 dot-namespaced WS protocol consumed verbatim from Plan 4, half-duplex Web Speech API audio (Plan 6 swaps for LiveKit + Gemini Live), heterogeneous transcript with inline product cards, new `POST /v1/session` endpoint mints WS tokens, `examples/host-page.html` for local smoke. Bundle size: NN KB gzip (XX% of 120KB budget). NNN/NNN tests pass. Live browser smoke deferred to operator. |
```

Also update the "Plans 1–4 complete" sentence in §9 to "Plans 1–5 complete (2026-05-04)".

Also update the Phase 1 row at the top of the same section to "Plans 1–5 ✅ complete; Plans 6–7 pending".

- [ ] **Step 2: Update memory entry**

Edit `C:\Users\naidu\.claude\projects\C--Users-naidu-Downloads-Personal-Agentic-shopper\memory\project_shoppingmate_phase1_status.md` and `MEMORY.md` index entry to reflect Plans 1–5 complete.

- [ ] **Step 3: Commit roadmap + memory updates**

```bash
git add docs/superpowers/roadmap.md
git commit -m "docs(roadmap): plan 5 ✅ complete — voice-first widget shell live"
```

- [ ] **Step 4: Tag**

```bash
git tag -a phase1-plan5-widget-shell-complete -m "Plan 5 — Voice-first widget shell complete (2026-05-04). NN tasks, NNN/NNN tests green."
```

---

## Self-review notes

- **Spec coverage:** every section of the design spec maps to at least one task. Specifically: §5.2 (POST /v1/session) → Tasks 4-6; §5.3 (WS protocol parity) → Task 7; §5.4 (transcript reducer) → Task 11; §5.5 (card tap path) → Tasks 14, 18; §5.6 (audio half-duplex) → Tasks 9-10; §5.7 (reconnect/resume) → Task 8; §5.8 (singleton + lifecycle) → Tasks 18-19; §8 (testing strategy) → all unit tests inline.
- **No placeholders.** Every step has either complete code, an exact command, or both.
- **Type consistency:** `TranscriptItem` defined once in `state/store.ts` and consumed by `ui/transcript.ts` + `ui/call.ts` + `ui/chat.ts`. `CardItem`, `WidgetMessage`, `AgentEvent` defined once in `transport/codec.ts`. `STT`/`TTS`/`VoiceMode` types defined once in their wrapper files.
- **Phase boundaries are clean** — Phase A has zero deps on later phases; Phase B touches only api; Phases C-E are pure utilities; Phases F-H build UI bottom-up; Phase I composes everything; Phase J is paperwork.
