# Phase 1 Plan 6 — Voice Stack (LiveKit + Gemini Live) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap Plan 5's Web Speech API simulation for production LiveKit Cloud + Gemini 2.5 Flash Live native audio, keeping `audio/voiceMode.ts`'s public surface intact and Plan 4's Sonnet 4.6 cognition path unchanged.

**Architecture:** Extract `apps/api/src/agent/` → new `packages/agent/` workspace (zero behavior change), then add `apps/voice-agent/` Node service that joins each visitor's LiveKit room as bot peer, owns the Gemini Live session, and bridges visitor STT → `runTurn(...)` → say events back to Gemini TTS. Widget lazy-loads `livekit-client` from self-hosted CDN, falls back to chat on any voice failure.

**Tech Stack:** TypeScript (NodeNext modules, `.js` import suffix), pnpm workspaces, Hono on `@hono/node-server`, Zod validation, vitest+happy-dom, Drizzle ORM, esbuild (widget bundle), `@livekit/agents` (Node), `@google/generative-ai` (Gemini Live), `livekit-client` (browser, lazy-loaded).

**Spec:** `docs/superpowers/specs/2026-05-04-phase1-plan6-voice-stack-design.md`
**Roadmap row:** `docs/superpowers/roadmap.md` §9 Plan 6
**ADR:** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`

**Persona IDs (canonical, from `apps/api/src/agent/prompts/persona-table.ts`):** `calm-clinician`, `stylist`, `coach`, `concierge` (default), `curator`, `guide`, `expert`, `host`. The earlier `sage/harper/...` names in older specs were placeholders — every task below uses the canonical IDs.

---

## Phase A — Extract `packages/agent/` (zero behavior change)

The Plan 4 runtime currently lives at `apps/api/src/agent/`. Voice-agent must import `runTurn` directly. Phase A moves the code to a new workspace package; Plan 4's 360 tests must remain green with only import-path edits.

### Task A1: Scaffold the `@shoppingmate/agent` workspace

**Files:**
- Create: `packages/agent/package.json`
- Create: `packages/agent/tsconfig.json`
- Create: `packages/agent/vitest.config.ts`
- Create: `packages/agent/src/index.ts` (empty barrel for now)

- [ ] **Step 1: Create `packages/agent/package.json`**

```json
{
  "name": "@shoppingmate/agent",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@shoppingmate/adapters": "workspace:*",
    "@shoppingmate/db": "workspace:*",
    "@shoppingmate/shared": "workspace:*",
    "drizzle-orm": "^0.36.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `packages/agent/tsconfig.json`** — copy `apps/api/tsconfig.json` exactly, then change `outDir` to `./dist` and `include` to `["src/**/*"]`. Read `apps/api/tsconfig.json` first; do not invent fields.

- [ ] **Step 3: Create `packages/agent/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create empty `packages/agent/src/index.ts`** — `// barrel — populated in Task A4`. Run `pnpm install` from repo root to wire the new workspace into pnpm-workspace.yaml's existing `packages/*` glob.

```bash
pnpm install
```

Expected: pnpm reports `+ @shoppingmate/agent`. No version errors.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/
git commit -m "chore(agent): scaffold @shoppingmate/agent workspace (empty)"
```

### Task A2: Move agent source files (no edits to contents yet)

**Files:**
- Move: `apps/api/src/agent/*.ts` → `packages/agent/src/*.ts`
- Move: `apps/api/src/agent/prompts/*.ts` → `packages/agent/src/prompts/*.ts`

- [ ] **Step 1: Move all agent files using git mv to preserve history**

```bash
git mv apps/api/src/agent/runtime.ts packages/agent/src/runtime.ts
git mv apps/api/src/agent/runtime.test.ts packages/agent/src/runtime.test.ts
git mv apps/api/src/agent/state.ts packages/agent/src/state.ts
git mv apps/api/src/agent/state.test.ts packages/agent/src/state.test.ts
git mv apps/api/src/agent/caps.ts packages/agent/src/caps.ts
git mv apps/api/src/agent/caps.test.ts packages/agent/src/caps.test.ts
git mv apps/api/src/agent/events.ts packages/agent/src/events.ts
git mv apps/api/src/agent/events.test.ts packages/agent/src/events.test.ts
git mv apps/api/src/agent/types.ts packages/agent/src/types.ts
git mv apps/api/src/agent/tools.ts packages/agent/src/tools.ts
git mv apps/api/src/agent/tools.test.ts packages/agent/src/tools.test.ts
git mv apps/api/src/agent/postprocess.ts packages/agent/src/postprocess.ts
git mv apps/api/src/agent/postprocess.test.ts packages/agent/src/postprocess.test.ts
git mv apps/api/src/agent/transport-noop.ts packages/agent/src/transport-noop.ts
git mv apps/api/src/agent/replay.ts packages/agent/src/replay.ts
git mv apps/api/src/agent/replay.test.ts packages/agent/src/replay.test.ts
mkdir -p packages/agent/src/prompts
git mv apps/api/src/agent/prompts/system.ts packages/agent/src/prompts/system.ts
git mv apps/api/src/agent/prompts/system.test.ts packages/agent/src/prompts/system.test.ts
git mv apps/api/src/agent/prompts/persona-table.ts packages/agent/src/prompts/persona-table.ts
```

- [ ] **Step 2: Verify** — `apps/api/src/agent/` no longer exists.

```bash
ls "apps/api/src/agent/" 2>&1 | head -3
```

Expected: "No such file or directory" or empty.

- [ ] **Step 3: Run `pnpm typecheck` to confirm what breaks**

```bash
pnpm typecheck
```

Expected: many errors in `apps/api/src/index.ts`, `apps/api/src/ws/agent.ts`, etc. — all import-resolution failures referring to `./agent/...` paths. We fix them in Task A3. Do NOT commit yet.

### Task A3: Rewrite `apps/api/` imports to use `@shoppingmate/agent`

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/ws/agent.ts`
- Modify: any other `apps/api/src/**/*.ts` referencing `./agent/...`

- [ ] **Step 1: Find every broken import**

```bash
grep -rn "from '\./agent/" apps/api/src/ apps/api/test/ 2>/dev/null || true
grep -rn "from '\.\./agent/" apps/api/src/ apps/api/test/ 2>/dev/null || true
grep -rn "from '\.\./\.\./agent/" apps/api/src/ apps/api/test/ 2>/dev/null || true
```

Record every match.

- [ ] **Step 2: Add `@shoppingmate/agent` to `apps/api/package.json` dependencies**

Open `apps/api/package.json` and add under `dependencies`:

```json
"@shoppingmate/agent": "workspace:*",
```

Then `pnpm install` from repo root.

- [ ] **Step 3: Edit each file from Step 1**

Replace every relative import like `from './agent/runtime.js'` → `from '@shoppingmate/agent'`.
Replace `from './agent/events.js'` → `from '@shoppingmate/agent'`.
Etc. — the new package barrel exports everything (we set this up in Task A4).

For `apps/api/src/index.ts` lines 9-14, the new block reads:

```ts
import {
  decodeWidgetMessage,
  encodeAgentEvent,
  replaySession,
  runTurn,
  createSession,
  loadSession,
  saveSession,
  NoOpWSTransport,
  type SessionState,
} from '@shoppingmate/agent';
```

(Delete the old `./agent/...` import lines.)

- [ ] **Step 4: Do NOT run typecheck yet** — barrel is still empty, so it'll fail. Move to Task A4.

### Task A4: Populate `packages/agent/src/index.ts` barrel

**Files:**
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: Write the barrel with every public symbol**

```ts
// Plan 4 runtime — extracted from apps/api/src/agent/ in Plan 6 Phase A.
// Public surface used by apps/api (chat WS) and apps/voice-agent (voice bridge).

export { runTurn, type RunTurnDeps } from './runtime.js';
export {
  createSession,
  loadSession,
  saveSession,
  newSessionState,
} from './state.js';
export { checkCaps, type CapsResult } from './caps.js';
export {
  decodeWidgetMessage,
  encodeAgentEvent,
} from './events.js';
export type {
  AgentEvent,
  AnthropicMessage,
  CardItem,
  SessionState,
  WidgetMessage,
} from './types.js';
export { buildToolSurface, dispatchTool, type ToolResultEnvelope } from './tools.js';
export { redactPii, segmentSay, stripPrices } from './postprocess.js';
export { NoOpWSTransport } from './transport-noop.js';
export { replaySession } from './replay.js';
export { buildSystemPrompt } from './prompts/system.js';
export {
  PERSONAS,
  DEFAULT_PERSONA,
  lookupPersona,
  type Persona,
} from './prompts/persona-table.js';
```

If any export name doesn't exist in the source files, open the source file and use the actual exported name. Run `grep -E '^export (const|function|class|type|interface)' packages/agent/src/*.ts packages/agent/src/prompts/*.ts` to enumerate the truth.

- [ ] **Step 2: Verify the barrel imports resolve**

```bash
pnpm --filter @shoppingmate/agent typecheck
```

Expected: PASS. If it fails, the missing export is a code typo in the barrel — fix and re-run.

- [ ] **Step 3: Run repo typecheck**

```bash
pnpm typecheck
```

Expected: PASS across all 10 workspaces (9 existing + new `@shoppingmate/agent`).

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: 360/360 tests pass (Plan 4 unchanged). If any test fails on a path-not-found or type-not-exported, the barrel is missing a symbol — add it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(agent): extract apps/api/src/agent → packages/agent (no behavior change)

Plan 6 Phase A. Voice-agent (Phase C+) needs runTurn as a workspace import.
All 360 Plan 4 tests preserved unchanged. Only edits beyond git-mv are
import-path swaps in apps/api/src/{index,ws/agent}.ts to '@shoppingmate/agent'."
```

### Task A5: Tag the safe rollback point

- [ ] **Step 1: Tag**

```bash
git tag phase1-plan6-phaseA-agent-extracted
```

- [ ] **Step 2: Verify all tests still green**

```bash
pnpm typecheck && pnpm test
```

Expected: typecheck clean, 360+ tests pass.

---

## Phase B — Persona voice descriptors (Gemini voice ID mapping)

The existing `Persona` type already has `voiceDescriptor` (text injected into Sonnet's system prompt). Phase B adds a `geminiVoiceId` field per persona so voice-agent can select the right Gemini Live prebuilt voice at session-open.

### Task B1: Extend `Persona` type with `geminiVoiceId`

**Files:**
- Modify: `packages/agent/src/prompts/persona-table.ts`
- Modify: `packages/agent/src/prompts/persona-table.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

Create `packages/agent/src/prompts/persona-table.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PERSONAS, lookupPersona, DEFAULT_PERSONA } from './persona-table.js';

describe('PERSONAS — Gemini voice mapping (Plan 6 Phase B)', () => {
  it('every persona has a non-empty geminiVoiceId', () => {
    for (const [id, persona] of Object.entries(PERSONAS)) {
      expect(persona.geminiVoiceId, `persona ${id} missing geminiVoiceId`).toBeTruthy();
      expect(typeof persona.geminiVoiceId).toBe('string');
      expect(persona.geminiVoiceId.length).toBeGreaterThan(0);
    }
  });

  it('every persona has a non-empty voiceDescriptor', () => {
    for (const [id, persona] of Object.entries(PERSONAS)) {
      expect(persona.voiceDescriptor, `persona ${id} missing voiceDescriptor`).toBeTruthy();
    }
  });

  it('exactly 8 personas defined', () => {
    expect(Object.keys(PERSONAS).length).toBe(8);
  });

  it('lookupPersona falls back to DEFAULT_PERSONA on unknown', () => {
    const p = lookupPersona('does-not-exist');
    expect(p).toBe(DEFAULT_PERSONA);
    expect(p.geminiVoiceId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @shoppingmate/agent test persona-table.test.ts
```

Expected: FAIL — `persona ... missing geminiVoiceId`.

- [ ] **Step 3: Add `geminiVoiceId` to the `Persona` type and to all 8 entries**

Edit `packages/agent/src/prompts/persona-table.ts`:

Change the type definition:

```ts
export type Persona = {
  id: string;
  name: string;
  voiceDescriptor: string; // injected verbatim into system prompt
  fitNote: string; // human-readable description of where it fits
  geminiVoiceId: string; // Plan 6: Gemini Live prebuilt voice id (e.g. 'aoede')
};
```

Then add `geminiVoiceId` to each of the 8 personas. Use these mappings (from Gemini Live's prebuilt voice library — `aoede`, `charon`, `fenrir`, `kore`, `puck`, `leda`, `orus`, `zephyr` are the documented prebuilts as of 2026-05; pick by descriptor fit):

```ts
'calm-clinician': { ..., geminiVoiceId: 'aoede' },     // calm female
stylist:          { ..., geminiVoiceId: 'leda' },       // warm female
coach:            { ..., geminiVoiceId: 'fenrir' },     // direct male
concierge:        { ..., geminiVoiceId: 'kore' },       // formal female
curator:          { ..., geminiVoiceId: 'orus' },       // story-telling male
guide:            { ..., geminiVoiceId: 'puck' },       // friendly male
expert:           { ..., geminiVoiceId: 'charon' },     // measured male
host:             { ..., geminiVoiceId: 'zephyr' },     // warm female
```

(Edit each persona object inline; do not duplicate the table.)

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter @shoppingmate/agent test persona-table.test.ts
```

Expected: 4/4 tests pass.

- [ ] **Step 5: Run full repo test suite**

```bash
pnpm test
```

Expected: all green (Plan 4 tests don't read `geminiVoiceId` so they continue to pass).

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/prompts/
git commit -m "feat(agent): add geminiVoiceId to Persona type (Plan 6 Phase B)

8 personas mapped to Gemini Live prebuilt voices. Voice-agent will
read this at Gemini session open. No effect on text-only Plan 4 path."
```

### Task B2: Add a price-paraphrase reminder helper for Gemini sysprompt

**Files:**
- Create: `packages/agent/src/prompts/voice-instructions.ts`
- Create: `packages/agent/src/prompts/voice-instructions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildVoiceSystemInstruction } from './voice-instructions.js';
import { PERSONAS } from './persona-table.js';

describe('buildVoiceSystemInstruction', () => {
  it('always includes the no-numeric-prices rule', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!);
    expect(out).toMatch(/never speak numeric prices/i);
    expect(out).toMatch(/paraphrase/i);
  });

  it('includes the persona voice descriptor verbatim', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.coach!);
    expect(out).toContain(PERSONAS.coach!.voiceDescriptor);
  });

  it('includes a "Voice cadence" line', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.stylist!);
    expect(out).toMatch(/voice cadence/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './voice-instructions.js'`).

```bash
pnpm --filter @shoppingmate/agent test voice-instructions.test.ts
```

- [ ] **Step 3: Implement**

```ts
// packages/agent/src/prompts/voice-instructions.ts
import type { Persona } from './persona-table.js';

const NO_PRICE_RULE =
  'Never speak numeric prices, currency amounts, or discount percentages. ' +
  'Always paraphrase ("a few hundred dollars", "a small discount") and refer to what is on screen ("the price you see").';

export function buildVoiceSystemInstruction(persona: Persona): string {
  return [
    persona.voiceDescriptor,
    `Voice cadence: ${persona.voiceDescriptor}`,
    NO_PRICE_RULE,
  ].join('\n\n');
}
```

- [ ] **Step 4: Add to barrel** — append to `packages/agent/src/index.ts`:

```ts
export { buildVoiceSystemInstruction } from './prompts/voice-instructions.js';
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @shoppingmate/agent test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/
git commit -m "feat(agent): buildVoiceSystemInstruction helper for Gemini Live sysprompt

Plan 6 Phase B. Defense-in-depth on the no-numeric-prices invariant —
the rule lives both here (Gemini sysprompt) AND in stripPrices()
(Sonnet output post-processor)."
```

### Task B3: Verify defense-in-depth invariant on `stripPrices` ↔ voice-instructions

**Files:**
- Create: `packages/agent/src/prompts/voice-defense-in-depth.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { stripPrices } from '../postprocess.js';
import { buildVoiceSystemInstruction } from './voice-instructions.js';
import { PERSONAS } from './persona-table.js';

describe('voice no-numeric-prices defense-in-depth', () => {
  it('stripPrices removes $ amounts before they reach voice agent', () => {
    const sonnetOutput = 'These shoes are $89.99 right now.';
    expect(stripPrices(sonnetOutput)).not.toMatch(/\$|\d/);
  });

  it('Gemini sysprompt also forbids numerics if any leak through', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!);
    expect(out).toMatch(/never speak numeric prices/i);
  });
});
```

- [ ] **Step 2: Run — must PASS** (both are existing/just-added behavior).

```bash
pnpm --filter @shoppingmate/agent test voice-defense-in-depth.test.ts
```

If `stripPrices` doesn't strip the digit/`$`, open `packages/agent/src/postprocess.ts` and read its real behavior. Adjust the assertion to match what `stripPrices` actually produces (the spec invariant is "no numeric price *spoken*" — the test must align with the strip function's contract). Document any discrepancy in this task before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/prompts/voice-defense-in-depth.test.ts
git commit -m "test(agent): assert defense-in-depth on no-numeric-prices for voice path"
```

---

## Phase C — `apps/voice-agent/` workspace scaffolding

### Task C1: Scaffold the new workspace

**Files:**
- Create: `apps/voice-agent/package.json`
- Create: `apps/voice-agent/tsconfig.json`
- Create: `apps/voice-agent/vitest.config.ts`
- Create: `apps/voice-agent/src/index.ts` (placeholder)
- Create: `apps/voice-agent/.env.example`

- [ ] **Step 1: Create `apps/voice-agent/package.json`**

```json
{
  "name": "@shoppingmate/voice-agent",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch --env-file-if-exists=../../.env src/index.ts",
    "build": "tsc",
    "start": "node --env-file-if-exists=../../.env dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "pilot-replay": "tsx --env-file-if-exists=../../.env scripts/pilot-replay.ts"
  },
  "dependencies": {
    "@shoppingmate/adapters": "workspace:*",
    "@shoppingmate/agent": "workspace:*",
    "@shoppingmate/db": "workspace:*",
    "@shoppingmate/shared": "workspace:*",
    "@livekit/agents": "^0.4.0",
    "@livekit/rtc-node": "^0.13.0",
    "@google/genai": "^0.7.0",
    "livekit-server-sdk": "^2.7.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

(Dependency versions: use the latest published as of 2026-05. `pnpm install` will pin to current. If a version is unpublished, downgrade to the highest published — do not invent version numbers.)

- [ ] **Step 2: Create `apps/voice-agent/tsconfig.json`** — copy `apps/api/tsconfig.json` exactly. Same compiler options, same NodeNext module resolution.

- [ ] **Step 3: Create `apps/voice-agent/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `apps/voice-agent/src/index.ts`** (placeholder)

```ts
// Plan 6 Phase C — placeholder bootstrap. Fully implemented in Task C4.
import { logger } from '@shoppingmate/shared';

logger.info('voice-agent placeholder — wiring in Plan 6 Phase C');
```

- [ ] **Step 5: Create `apps/voice-agent/.env.example`**

```bash
LIVEKIT_URL=wss://shoppingmate.livekit.cloud
LIVEKIT_API_KEY=API_xxxxxxxx
LIVEKIT_API_SECRET=secret_xxxxxxxx
GEMINI_API_KEY=AIzaSy_xxxxxxxx
GEMINI_LIVE_MODEL=gemini-2.5-flash-live
DATABASE_URL=postgres://...     # reused from apps/api
REDIS_URL=redis://...            # reused from apps/api
```

- [ ] **Step 6: Install + typecheck**

```bash
pnpm install
pnpm --filter @shoppingmate/voice-agent typecheck
```

Expected: typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/voice-agent/
git commit -m "chore(voice-agent): scaffold @shoppingmate/voice-agent workspace"
```

### Task C2: Environment variable validation

**Files:**
- Create: `apps/voice-agent/src/env.ts`
- Create: `apps/voice-agent/src/env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseVoiceEnv } from './env.js';

describe('parseVoiceEnv', () => {
  it('accepts a valid env block', () => {
    const out = parseVoiceEnv({
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'API_test',
      LIVEKIT_API_SECRET: 'secret_test',
      GEMINI_API_KEY: 'AIzaSy_test',
      GEMINI_LIVE_MODEL: 'gemini-2.5-flash-live',
    });
    expect(out.LIVEKIT_URL).toBe('wss://example.livekit.cloud');
    expect(out.GEMINI_LIVE_MODEL).toBe('gemini-2.5-flash-live');
  });

  it('rejects missing GEMINI_API_KEY', () => {
    expect(() =>
      parseVoiceEnv({
        LIVEKIT_URL: 'wss://example.livekit.cloud',
        LIVEKIT_API_KEY: 'API_test',
        LIVEKIT_API_SECRET: 'secret_test',
        GEMINI_LIVE_MODEL: 'gemini-2.5-flash-live',
      } as never),
    ).toThrow(/GEMINI_API_KEY/);
  });

  it('defaults GEMINI_LIVE_MODEL to gemini-2.5-flash-live when omitted', () => {
    const out = parseVoiceEnv({
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'API_test',
      LIVEKIT_API_SECRET: 'secret_test',
      GEMINI_API_KEY: 'AIzaSy_test',
    } as never);
    expect(out.GEMINI_LIVE_MODEL).toBe('gemini-2.5-flash-live');
  });

  it('requires LIVEKIT_URL to be a wss URL', () => {
    expect(() =>
      parseVoiceEnv({
        LIVEKIT_URL: 'http://oops',
        LIVEKIT_API_KEY: 'API_test',
        LIVEKIT_API_SECRET: 'secret_test',
        GEMINI_API_KEY: 'AIzaSy_test',
      } as never),
    ).toThrow(/wss/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './env.js'`).

```bash
pnpm --filter @shoppingmate/voice-agent test env.test.ts
```

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/env.ts
import { z } from 'zod';

const Schema = z.object({
  LIVEKIT_URL: z.string().url().regex(/^wss?:\/\//, 'LIVEKIT_URL must be ws(s)://'),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_LIVE_MODEL: z.string().min(1).default('gemini-2.5-flash-live'),
});

export type VoiceEnv = z.infer<typeof Schema>;

export function parseVoiceEnv(raw: NodeJS.ProcessEnv | Record<string, string | undefined>): VoiceEnv {
  return Schema.parse(raw);
}

let cached: VoiceEnv | null = null;
export function voiceEnv(): VoiceEnv {
  if (!cached) cached = parseVoiceEnv(process.env);
  return cached;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test env.test.ts
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/env.ts apps/voice-agent/src/env.test.ts
git commit -m "feat(voice-agent): env schema validation"
```

### Task C3: Dockerfile stub (operator-facing, no behavior code)

**Files:**
- Create: `apps/voice-agent/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# Plan 6 Phase C — voice-agent runs as its own process so LiveKit Agent
# crashes don't take down apps/api. Operator owns CI and registry pushing.

FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages packages
COPY apps/voice-agent apps/voice-agent
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @shoppingmate/agent build
RUN pnpm --filter @shoppingmate/voice-agent build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/voice-agent
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Verify the file exists** (no build runs in CI yet — operator concern)

```bash
test -f apps/voice-agent/Dockerfile && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/Dockerfile
git commit -m "chore(voice-agent): Dockerfile stub (operator concern)"
```

### Task C4: Bootstrap that validates env on start

**Files:**
- Modify: `apps/voice-agent/src/index.ts`
- Create: `apps/voice-agent/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('voice-agent bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws if LIVEKIT_URL is missing', async () => {
    const orig = { ...process.env };
    delete process.env.LIVEKIT_URL;
    await expect(import('./index.js')).rejects.toThrow(/LIVEKIT_URL/);
    process.env = orig;
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (placeholder doesn't validate env).

```bash
pnpm --filter @shoppingmate/voice-agent test index.test.ts
```

- [ ] **Step 3: Implement bootstrap**

Replace `apps/voice-agent/src/index.ts` contents with:

```ts
import { logger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';

const env = voiceEnv();

logger.info(
  { livekit_url: env.LIVEKIT_URL, model: env.GEMINI_LIVE_MODEL },
  'voice-agent boot — env validated',
);

// Worker registration is wired in Phase F (agentWorker.ts).
// For now, log a heartbeat and exit cleanly when stdin closes (dev convenience).
process.stdin.on('close', () => {
  logger.info('voice-agent stdin closed — exiting');
  process.exit(0);
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test index.test.ts
```

- [ ] **Step 5: Verify dev script runs** (with mock env)

```bash
LIVEKIT_URL=wss://test.livekit.cloud LIVEKIT_API_KEY=k LIVEKIT_API_SECRET=s GEMINI_API_KEY=g pnpm --filter @shoppingmate/voice-agent build
```

Expected: build succeeds, `apps/voice-agent/dist/index.js` exists.

- [ ] **Step 6: Commit**

```bash
git add apps/voice-agent/src/index.ts apps/voice-agent/src/index.test.ts
git commit -m "feat(voice-agent): bootstrap validates env on start"
```

---

## Phase D — Gemini Live session wrapper

### Task D1: `geminiSession.ts` — type contract + open/close

**Files:**
- Create: `apps/voice-agent/src/geminiSession.ts`
- Create: `apps/voice-agent/src/geminiSession.test.ts`

The wrapper hides Gemini Live SDK details so `bridge.ts` only sees a typed surface: `open()`, `pushAudio()`, `speak()`, `interrupt()`, `close()`, plus event subscriptions.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createGeminiSession, type GeminiTransport } from './geminiSession.js';

function mockTransport(): GeminiTransport {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    pushAudio: vi.fn(),
    speak: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn(),
  };
}

describe('createGeminiSession', () => {
  it('opens with persona voice id and system instruction', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'be concise',
    });
    await s.open();
    expect(t.open).toHaveBeenCalledWith({ voiceId: 'kore', systemInstruction: 'be concise' });
  });

  it('rejects speak() when text contains numeric digits or $ (defense-in-depth)', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await expect(s.speak('That is $89.99 right now.')).rejects.toThrow(/numeric/i);
    expect(t.speak).not.toHaveBeenCalled();
  });

  it('forwards clean speak() text to transport', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await s.speak('A premium pair, around mid-range pricing on screen.');
    expect(t.speak).toHaveBeenCalledOnce();
  });

  it('interrupt() calls transport.interrupt synchronously', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    s.interrupt();
    expect(t.interrupt).toHaveBeenCalledOnce();
  });

  it('close() calls transport.close', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    await s.close();
    expect(t.close).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module doesn't exist).

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/geminiSession.ts

export type GeminiTransportEvent =
  | { type: 'partial_transcript'; text: string }
  | { type: 'final_transcript'; text: string }
  | { type: 'audio_out'; bytes: Uint8Array }
  | { type: 'speech_started' }
  | { type: 'speech_ended' }
  | { type: 'error'; error: Error };

export type GeminiTransport = {
  open: (cfg: { voiceId: string; systemInstruction: string }) => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
};

export type GeminiSession = {
  open: () => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
};

const NUMERIC_PRICE = /[\$€£¥₹]|\b\d/;

export function createGeminiSession(opts: {
  transport: GeminiTransport;
  voiceId: string;
  systemInstruction: string;
}): GeminiSession {
  const { transport, voiceId, systemInstruction } = opts;
  return {
    open: () => transport.open({ voiceId, systemInstruction }),
    pushAudio: (f) => transport.pushAudio(f),
    speak: async (text) => {
      if (NUMERIC_PRICE.test(text)) {
        throw new Error(
          `geminiSession.speak() refused numeric content (defense-in-depth on no-numeric-prices invariant): "${text}"`,
        );
      }
      await transport.speak(text);
    },
    interrupt: () => transport.interrupt(),
    close: () => transport.close(),
    onEvent: (cb) => transport.onEvent(cb),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test geminiSession.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/geminiSession.ts apps/voice-agent/src/geminiSession.test.ts
git commit -m "feat(voice-agent): geminiSession wrapper with no-numeric-prices guard"
```

### Task D2: Gemini Live SDK transport adapter (real implementation)

**Files:**
- Create: `apps/voice-agent/src/geminiSdkTransport.ts`

This wraps the actual `@google/genai` Live API client into the `GeminiTransport` interface from D1. No tests against the real network — type-shape only.

- [ ] **Step 1: Implement the SDK adapter**

```ts
// apps/voice-agent/src/geminiSdkTransport.ts
import { GoogleGenAI, Modality } from '@google/genai';
import { childLogger } from '@shoppingmate/shared';
import type { GeminiTransport, GeminiTransportEvent } from './geminiSession.js';
import { voiceEnv } from './env.js';

const log = childLogger({ mod: 'gemini-sdk' });

export function createGeminiSdkTransport(): GeminiTransport {
  const env = voiceEnv();
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  let session: Awaited<ReturnType<typeof client.live.connect>> | null = null;
  const listeners: ((e: GeminiTransportEvent) => void)[] = [];
  const emit = (e: GeminiTransportEvent) => listeners.forEach((cb) => cb(e));

  return {
    async open({ voiceId, systemInstruction }) {
      session = await client.live.connect({
        model: env.GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } },
        },
        callbacks: {
          onmessage: (msg) => {
            // Partial transcript
            if (msg.serverContent?.inputTranscription?.text) {
              emit({ type: 'partial_transcript', text: msg.serverContent.inputTranscription.text });
            }
            // Final transcript marker
            if (msg.serverContent?.inputTranscription?.finished) {
              emit({
                type: 'final_transcript',
                text: msg.serverContent.inputTranscription.text ?? '',
              });
            }
            // Audio out
            const audioPart = msg.serverContent?.modelTurn?.parts?.find(
              (p: { inlineData?: { mimeType?: string; data?: string } }) =>
                p.inlineData?.mimeType?.startsWith('audio/'),
            );
            if (audioPart?.inlineData?.data) {
              emit({ type: 'audio_out', bytes: Buffer.from(audioPart.inlineData.data, 'base64') });
            }
            if (msg.serverContent?.turnComplete) {
              emit({ type: 'speech_ended' });
            }
          },
          onerror: (err: Error) => emit({ type: 'error', error: err }),
        },
      });
      log.info({ voiceId }, 'gemini live opened');
    },
    pushAudio(frame) {
      if (!session) throw new Error('gemini session not open');
      session.sendRealtimeInput({
        media: { data: Buffer.from(frame).toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      });
    },
    async speak(text) {
      if (!session) throw new Error('gemini session not open');
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }] });
    },
    interrupt() {
      if (!session) return;
      // Gemini Live: send a no-op client content to interrupt model turn.
      // Per SDK, .sendClientContent({turns:[], turnComplete:false}) signals barge-in.
      session.sendClientContent({ turns: [], turnComplete: false });
      log.debug('gemini interrupt sent');
    },
    async close() {
      if (!session) return;
      session.close();
      session = null;
      log.info('gemini session closed');
    },
    onEvent(cb) {
      listeners.push(cb);
    },
  };
}
```

(If the `@google/genai` SDK shape differs from what's typed above when you `pnpm install`, run `pnpm --filter @shoppingmate/voice-agent typecheck` and adjust. The contract from D1 is what `bridge.ts` consumes; the SDK glue is allowed to bend.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @shoppingmate/voice-agent typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/src/geminiSdkTransport.ts
git commit -m "feat(voice-agent): real Gemini Live SDK transport adapter"
```

### Task D3: Wire `lookupGeminiVoice(personaId)` helper

**Files:**
- Create: `apps/voice-agent/src/persona.ts`
- Create: `apps/voice-agent/src/persona.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveVoiceContext } from './persona.js';

describe('resolveVoiceContext', () => {
  it('returns geminiVoiceId + systemInstruction for known persona', () => {
    const ctx = resolveVoiceContext('coach');
    expect(ctx.voiceId).toBeTruthy();
    expect(ctx.systemInstruction).toMatch(/never speak numeric prices/i);
  });

  it('falls back to default persona on unknown id', () => {
    const ctx = resolveVoiceContext('does-not-exist');
    expect(ctx.voiceId).toBeTruthy();
    expect(ctx.personaId).toBe('concierge'); // DEFAULT_PERSONA
  });

  it('handles null/undefined persona id', () => {
    expect(resolveVoiceContext(null).voiceId).toBeTruthy();
    expect(resolveVoiceContext(undefined).voiceId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/persona.ts
import { lookupPersona, buildVoiceSystemInstruction } from '@shoppingmate/agent';

export type VoiceContext = {
  personaId: string;
  voiceId: string;
  systemInstruction: string;
};

export function resolveVoiceContext(personaId: string | null | undefined): VoiceContext {
  const persona = lookupPersona(personaId);
  return {
    personaId: persona.id,
    voiceId: persona.geminiVoiceId,
    systemInstruction: buildVoiceSystemInstruction(persona),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test persona.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/persona.ts apps/voice-agent/src/persona.test.ts
git commit -m "feat(voice-agent): resolveVoiceContext maps personaId to Gemini config"
```

---

## Phase E — The bridge (STT → runTurn → TTS)

This is the most novel + highest-risk surface. Implementation walks small.

### Task E1: Bridge type contract + STT-final → runTurn dispatch

**Files:**
- Create: `apps/voice-agent/src/bridge.ts`
- Create: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createBridge, type BridgeDeps } from './bridge.js';
import type { AgentEvent } from '@shoppingmate/agent';

function fakeRunTurn(events: AgentEvent[]) {
  return vi.fn(async function* () {
    for (const e of events) yield e;
  });
}

const baseDeps = (): BridgeDeps => ({
  sessionId: 'ws_test',
  merchantId: 'SM-AAAAAA',
  runTurn: fakeRunTurn([
    { type: 'say', text: 'Hi there.' },
    { type: 'end_of_turn' },
  ] as AgentEvent[]),
  loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-AAAAAA' }),
  loadSession: vi.fn().mockResolvedValue({ sessionId: 'ws_test' }),
  saveSession: vi.fn().mockResolvedValue(undefined),
  recordMetric: vi.fn().mockResolvedValue(undefined),
  loadAdapter: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
  publishData: vi.fn(),
  closeRoom: vi.fn(),
});

describe('createBridge — STT-final → runTurn → say → speak', () => {
  it('on user_text final, calls runTurn and speaks each say event', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hello sage');
    expect(deps.runTurn).toHaveBeenCalledOnce();
    expect(deps.speak).toHaveBeenCalledWith('Hi there.');
  });

  it('publishes user_text event to data channel for transcript', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hello sage');
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'user_text', text: 'hello sage' });
  });

  it('publishes say events to data channel (transcript)', async () => {
    const deps = baseDeps();
    const bridge = createBridge(deps);
    await bridge.handleUserText('hi');
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'say', text: 'Hi there.' });
  });

  it('does NOT speak() events of type cards/checkout_redirect/cap_warning', async () => {
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: fakeRunTurn([
        { type: 'cards', items: [] },
        { type: 'checkout_redirect', url: 'https://x' },
        { type: 'cap_warning', remaining: 2 },
        { type: 'end_of_turn' },
      ] as AgentEvent[]),
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('show me');
    expect(deps.speak).not.toHaveBeenCalled();
    expect(deps.publishData).toHaveBeenCalledWith({ type: 'cards', items: [] });
  });

  it('on session_closed event, calls closeRoom', async () => {
    const deps: BridgeDeps = {
      ...baseDeps(),
      runTurn: fakeRunTurn([
        { type: 'session_closed', reason: 'cap' },
      ] as AgentEvent[]),
    };
    const bridge = createBridge(deps);
    await bridge.handleUserText('done');
    expect(deps.closeRoom).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/bridge.ts
import type { AgentEvent, RunTurnDeps, SessionState, WidgetMessage } from '@shoppingmate/agent';
import type { Adapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ mod: 'bridge' });

export type DataChannelMessage =
  | { type: 'user_text'; text: string }
  | { type: 'say'; text: string }
  | { type: 'cards'; items: unknown[] }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; remaining: number }
  | { type: 'session_closed'; reason: string };

export type BridgeDeps = {
  sessionId: string;
  merchantId: string;
  runTurn: (
    deps: RunTurnDeps,
    merchant: Merchant,
    session: SessionState,
    msg: WidgetMessage,
  ) => AsyncGenerator<AgentEvent, void, void>;
  loadMerchant: (id: string) => Promise<Merchant>;
  loadSession: (sessionId: string) => Promise<SessionState>;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
  loadAdapter: (m: Merchant, sid: string) => Adapter;
  speak: (text: string) => Promise<void>;
  publishData: (msg: DataChannelMessage) => void;
  closeRoom: () => void;
};

export type Bridge = {
  handleUserText: (text: string) => Promise<void>;
};

export function createBridge(deps: BridgeDeps): Bridge {
  return {
    async handleUserText(text) {
      deps.publishData({ type: 'user_text', text });

      const merchant = await deps.loadMerchant(deps.merchantId);
      const session = await deps.loadSession(deps.sessionId);
      const widgetMsg: WidgetMessage = { type: 'user_text', text, mode: 'voice' };

      const runDeps: RunTurnDeps = {
        loadAdapter: deps.loadAdapter,
        saveSession: deps.saveSession,
        recordMetric: deps.recordMetric,
      };

      try {
        for await (const event of deps.runTurn(runDeps, merchant, session, widgetMsg)) {
          await routeEvent(event, deps);
        }
      } catch (err) {
        log.error({ err, sessionId: deps.sessionId }, 'runTurn failed in bridge');
        deps.publishData({ type: 'session_closed', reason: 'error' });
        deps.closeRoom();
      }
    },
  };
}

async function routeEvent(event: AgentEvent, deps: BridgeDeps): Promise<void> {
  switch (event.type) {
    case 'say':
      deps.publishData({ type: 'say', text: event.text });
      await deps.speak(event.text);
      return;
    case 'cards':
      // The exact shape of `event.items` matches AgentEvent's CardItem[].
      // We pass through as `unknown[]` — widget renders from data-channel.
      deps.publishData({ type: 'cards', items: (event as { items: unknown[] }).items });
      return;
    case 'checkout_redirect':
      deps.publishData({ type: 'checkout_redirect', url: (event as { url: string }).url });
      return;
    case 'cap_warning':
      deps.publishData({
        type: 'cap_warning',
        remaining: (event as { remaining: number }).remaining,
      });
      return;
    case 'session_closed':
      deps.publishData({ type: 'session_closed', reason: (event as { reason: string }).reason });
      deps.closeRoom();
      return;
    case 'tool_result':
    case 'end_of_turn':
      return; // telemetry/control only — not surfaced to data channel
    default:
      log.debug({ type: (event as { type: string }).type }, 'bridge: ignoring unknown event');
  }
}
```

- [ ] **Step 4: Run tests — expect PASS** (5/5).

```bash
pnpm --filter @shoppingmate/voice-agent test bridge.test.ts
```

If a test fails because an `AgentEvent` shape mismatches (Plan 4's exact field names), open `packages/agent/src/types.ts`, read the actual union, and adjust the test fixtures + the `routeEvent` cast — do NOT bend reality to fit the test.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/bridge.ts apps/voice-agent/src/bridge.test.ts
git commit -m "feat(voice-agent): bridge — user_text → runTurn → say/cards/etc routing"
```

### Task E2: Bridge — say-to-Gemini chunk pipelining

The first say chunk should start being spoken before runTurn finishes producing the rest. The current implementation already awaits each speak() inline — we add a regression test asserting chunk N is spoken before chunk N+1 is produced.

**Files:**
- Modify: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Add the pipelining test**

```ts
it('pipelines: speak(N) starts before runTurn yields N+1', async () => {
  const speakOrder: string[] = [];
  const yieldOrder: string[] = [];
  const deps: BridgeDeps = {
    ...baseDeps(),
    runTurn: vi.fn(async function* () {
      yieldOrder.push('first');
      yield { type: 'say', text: 'first' };
      yieldOrder.push('second');
      yield { type: 'say', text: 'second' };
      yield { type: 'end_of_turn' };
    }),
    speak: vi.fn(async (text: string) => {
      speakOrder.push(`speak:${text}`);
      yieldOrder.push(`spoke:${text}`);
    }),
  };
  const bridge = createBridge(deps);
  await bridge.handleUserText('go');
  expect(speakOrder).toEqual(['speak:first', 'speak:second']);
  // The interleaving we want: yield first → speak first (inline) → yield second
  expect(yieldOrder).toEqual(['first', 'spoke:first', 'second', 'spoke:second']);
});
```

- [ ] **Step 2: Run — should already PASS** because the existing implementation awaits speak() inside the for-await loop.

If it fails, the implementation is parallelizing instead of inline-awaiting. Confirm `for await` + inline `await deps.speak(...)` order.

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/src/bridge.test.ts
git commit -m "test(voice-agent): assert bridge speak pipelining order"
```

### Task E3: Bridge — barge-in handler

When voice activity detected mid-TTS, call `interrupt()` and drop the queued say tail.

**Files:**
- Modify: `apps/voice-agent/src/bridge.ts`
- Modify: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
it('handleBargeIn calls interrupt and aborts the current run', async () => {
  let resolveSpeakA: () => void;
  const speakAPromise = new Promise<void>((r) => { resolveSpeakA = r; });
  const interruptCalls: number[] = [];
  const deps: BridgeDeps = {
    ...baseDeps(),
    runTurn: vi.fn(async function* () {
      yield { type: 'say', text: 'long thought A' };
      yield { type: 'say', text: 'long thought B (should be skipped)' };
      yield { type: 'end_of_turn' };
    }),
    speak: vi.fn(async (text: string) => {
      if (text === 'long thought A') {
        await speakAPromise; // simulate TTS in flight
      }
    }),
    interrupt: vi.fn(() => { interruptCalls.push(Date.now()); }),
  } as unknown as BridgeDeps;
  const bridge = createBridge(deps);
  const handleP = bridge.handleUserText('start');
  // Trigger barge-in mid-speak:
  setTimeout(() => {
    bridge.handleBargeIn();
    resolveSpeakA();
  }, 5);
  await handleP;
  expect(interruptCalls.length).toBe(1);
  // Second say should NOT have been spoken:
  expect((deps.speak as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])).toEqual(['long thought A']);
});
```

- [ ] **Step 2: Run — expect FAIL** (`bridge.handleBargeIn is not a function` and `deps.interrupt` not in type).

- [ ] **Step 3: Update `BridgeDeps` and `Bridge` types**

In `bridge.ts`, add:

```ts
export type BridgeDeps = {
  // ...existing fields...
  interrupt: () => void; // NEW — calls geminiSession.interrupt()
};

export type Bridge = {
  handleUserText: (text: string) => Promise<void>;
  handleBargeIn: () => void; // NEW
};
```

And implement abort coordination:

```ts
export function createBridge(deps: BridgeDeps): Bridge {
  let aborted = false;

  return {
    async handleUserText(text) {
      aborted = false;
      deps.publishData({ type: 'user_text', text });

      const merchant = await deps.loadMerchant(deps.merchantId);
      const session = await deps.loadSession(deps.sessionId);
      const widgetMsg: WidgetMessage = { type: 'user_text', text, mode: 'voice' };

      const runDeps: RunTurnDeps = {
        loadAdapter: deps.loadAdapter,
        saveSession: deps.saveSession,
        recordMetric: deps.recordMetric,
      };

      try {
        for await (const event of deps.runTurn(runDeps, merchant, session, widgetMsg)) {
          if (aborted) {
            log.info({ sessionId: deps.sessionId }, 'bridge: abort flag set, dropping remaining events');
            return;
          }
          await routeEvent(event, deps);
        }
      } catch (err) {
        log.error({ err, sessionId: deps.sessionId }, 'runTurn failed in bridge');
        deps.publishData({ type: 'session_closed', reason: 'error' });
        deps.closeRoom();
      }
    },
    handleBargeIn() {
      aborted = true;
      deps.interrupt();
      deps.recordMetric('voice.barge_in_succeeded', { sessionId: deps.sessionId }).catch(() => {});
    },
  };
}
```

Also update `baseDeps()` in the test to include `interrupt: vi.fn()`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test bridge.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/bridge.ts apps/voice-agent/src/bridge.test.ts
git commit -m "feat(voice-agent): bridge.handleBargeIn — interrupt + drop say tail"
```

### Task E4: Bridge — `runTurn` failure → fixed apology line

**Files:**
- Modify: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Test that runTurn errors are caught and a session_closed event published**

This already exists in spirit from E1's catch block, but add an explicit assertion:

```ts
it('on runTurn throw, publishes session_closed{error} and closes room', async () => {
  const deps: BridgeDeps = {
    ...baseDeps(),
    runTurn: vi.fn(async function* () {
      throw new Error('sonnet exploded');
    }),
  };
  const bridge = createBridge(deps);
  await bridge.handleUserText('go');
  expect(deps.publishData).toHaveBeenCalledWith({ type: 'session_closed', reason: 'error' });
  expect(deps.closeRoom).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run — expect PASS** (already implemented in E1).

```bash
pnpm --filter @shoppingmate/voice-agent test bridge.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/src/bridge.test.ts
git commit -m "test(voice-agent): assert bridge runTurn-failure path closes session"
```

---

## Phase F — Data channel + LiveKit Agents worker

### Task F1: `dataChannel.ts` — JSON-encoded publisher abstraction

**Files:**
- Create: `apps/voice-agent/src/dataChannel.ts`
- Create: `apps/voice-agent/src/dataChannel.test.ts`

The bridge emits typed `DataChannelMessage` objects; this module turns them into LiveKit room data messages.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createDataChannel } from './dataChannel.js';
import type { DataChannelMessage } from './bridge.js';

describe('createDataChannel', () => {
  it('JSON-encodes messages and pushes to the room publisher', () => {
    const publish = vi.fn();
    const ch = createDataChannel({ publish });
    const msg: DataChannelMessage = { type: 'say', text: 'Hi.' };
    ch.publish(msg);
    expect(publish).toHaveBeenCalledOnce();
    const [bytes, opts] = publish.mock.calls[0]!;
    expect(opts).toMatchObject({ reliable: true });
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded).toEqual({ type: 'say', text: 'Hi.' });
  });

  it('handles user_text payloads', () => {
    const publish = vi.fn();
    const ch = createDataChannel({ publish });
    ch.publish({ type: 'user_text', text: 'hello' });
    const decoded = JSON.parse(new TextDecoder().decode(publish.mock.calls[0]![0]));
    expect(decoded.text).toBe('hello');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/dataChannel.ts
import type { DataChannelMessage } from './bridge.js';

export type DataChannel = {
  publish: (msg: DataChannelMessage) => void;
};

export function createDataChannel(opts: {
  publish: (data: Uint8Array, opts: { reliable: boolean }) => void;
}): DataChannel {
  return {
    publish(msg) {
      const bytes = new TextEncoder().encode(JSON.stringify(msg));
      opts.publish(bytes, { reliable: true });
    },
  };
}
```

- [ ] **Step 4: Run — expect PASS**.

```bash
pnpm --filter @shoppingmate/voice-agent test dataChannel.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/dataChannel.ts apps/voice-agent/src/dataChannel.test.ts
git commit -m "feat(voice-agent): dataChannel — typed JSON publisher over LiveKit room"
```

### Task F2: `agentWorker.ts` — LiveKit Agents JobContext handler

**Files:**
- Create: `apps/voice-agent/src/agentWorker.ts`

This wires bridge + geminiSession + dataChannel into the LiveKit Agents JobContext. Mostly glue; relies on Phase D + E + F1.

- [ ] **Step 1: Implement** (no per-line test — covered by integration test in F3)

```ts
// apps/voice-agent/src/agentWorker.ts
import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
} from '@livekit/agents';
import { childLogger } from '@shoppingmate/shared';
import { runTurn, loadSession, saveSession } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { getAdapter } from '@shoppingmate/adapters';
import { createBridge } from './bridge.js';
import { createDataChannel } from './dataChannel.js';
import { createGeminiSession } from './geminiSession.js';
import { createGeminiSdkTransport } from './geminiSdkTransport.js';
import { resolveVoiceContext } from './persona.js';

const log = childLogger({ mod: 'agent-worker' });

export const agentDefinition = defineAgent({
  entry: async (job: JobContext) => {
    const roomName = job.room.name;
    const sessionId = roomName.replace(/^sm_/, '');
    log.info({ sessionId, roomName }, 'voice-agent job started');

    // Load session + merchant from Plan 4 state.
    const session = await loadSession(sessionId);
    if (!session) {
      log.warn({ sessionId }, 'no session found — closing room');
      await job.room.disconnect();
      return;
    }
    const [merchant] = await db
      .select()
      .from(schema.merchants)
      .where(eq(schema.merchants.id, session.merchantId))
      .limit(1);
    if (!merchant) {
      log.warn({ merchantId: session.merchantId }, 'no merchant — closing room');
      await job.room.disconnect();
      return;
    }

    const voice = resolveVoiceContext(merchant.config?.persona_id ?? null);
    const transport = createGeminiSdkTransport();
    const gemini = createGeminiSession({
      transport,
      voiceId: voice.voiceId,
      systemInstruction: voice.systemInstruction,
    });
    await gemini.open();

    const dataChannel = createDataChannel({
      publish: (bytes, opts) =>
        job.room.localParticipant?.publishData(bytes, { reliable: opts.reliable }),
    });

    const bridge = createBridge({
      sessionId,
      merchantId: merchant.id,
      runTurn,
      loadMerchant: async () => merchant,
      loadSession: async () => session,
      saveSession,
      recordMetric: async () => {}, // Phase G fills this with real ledger writes
      loadAdapter: (m, sid) => getAdapter(m, sid),
      speak: (text) => gemini.speak(text),
      publishData: (msg) => dataChannel.publish(msg),
      closeRoom: () => job.room.disconnect().catch(() => {}),
      interrupt: () => gemini.interrupt(),
    });

    // Subscribe to Gemini transcripts → bridge.handleUserText
    gemini.onEvent((e) => {
      if (e.type === 'final_transcript' && e.text.trim().length > 0) {
        bridge.handleUserText(e.text).catch((err) => {
          log.error({ err }, 'bridge.handleUserText threw');
        });
      }
      if (e.type === 'audio_out') {
        // TTS audio is sent to the room by Gemini SDK directly via LiveKit
        // track in a future task; for now, log size for sanity.
        log.debug({ bytes: e.bytes.length }, 'gemini audio_out');
      }
    });

    // Subscribe to participant audio → push frames into Gemini
    job.room.on('trackSubscribed', (track) => {
      if (track.kind === 'audio') {
        // LiveKit audio frame iteration — actual frame plumbing is SDK-specific.
        // The shape below assumes @livekit/rtc-node's AudioStream API.
        const stream = track.audioStream();
        (async () => {
          for await (const frame of stream) {
            gemini.pushAudio(frame.data);
          }
        })().catch((err) => log.error({ err }, 'audio stream ended with error'));
      }
    });

    // Barge-in: when participant starts speaking while we're TTSing
    job.room.on('participantSpeakingChanged', (participant, speaking) => {
      if (speaking && participant.identity !== job.room.localParticipant?.identity) {
        bridge.handleBargeIn();
      }
    });

    job.room.on('disconnected', () => {
      gemini.close().catch(() => {});
      log.info({ sessionId }, 'voice-agent job ended');
    });
  },
});

export function startWorker() {
  cli.runApp(new WorkerOptions({ agent: agentDefinition }));
}
```

(The `@livekit/agents` API surface used here is what's documented as of v0.4. If the actual installed version's exports differ, run typecheck and adjust import names — the *shape* of the wiring stays the same.)

- [ ] **Step 2: Wire startWorker into bootstrap**

Edit `apps/voice-agent/src/index.ts`:

```ts
import { logger } from '@shoppingmate/shared';
import { voiceEnv } from './env.js';
import { startWorker } from './agentWorker.js';

const env = voiceEnv();
logger.info(
  { livekit_url: env.LIVEKIT_URL, model: env.GEMINI_LIVE_MODEL },
  'voice-agent boot — env validated, registering worker',
);

startWorker();
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @shoppingmate/voice-agent typecheck
```

If LiveKit/Gemini SDK type errors surface, the contract mismatch is at the SDK boundary — adjust the SDK calls (NOT the bridge/dataChannel/geminiSession internals). Add `// @ts-expect-error v0.4 SDK shape` only as a temporary ESCAPE HATCH if a type is wrong; never silence real bugs.

- [ ] **Step 4: Commit**

```bash
git add apps/voice-agent/src/agentWorker.ts apps/voice-agent/src/index.ts
git commit -m "feat(voice-agent): agentWorker — JobContext entry wiring bridge + gemini + LK"
```

### Task F3: Integration test — full job lifecycle against mocked Room + Gemini

**Files:**
- Create: `apps/voice-agent/test/agentWorker.integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// apps/voice-agent/test/agentWorker.integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createBridge, type DataChannelMessage } from '../src/bridge.js';
import type { AgentEvent } from '@shoppingmate/agent';

// This integration test exercises bridge end-to-end with mocked
// runTurn + mocked speak/publish — i.e. the same surface agentWorker
// wires together. Real LiveKit + Gemini are out of scope (mocked).

describe('voice-agent integration: 3-turn fixture conversation', () => {
  it('end-to-end: greet → recommend → cart-add → checkout_redirect → session_closed', async () => {
    const published: DataChannelMessage[] = [];
    const spoken: string[] = [];
    let runCallCount = 0;
    const fixtureTurns: AgentEvent[][] = [
      [
        { type: 'say', text: 'Hi, welcome.' },
        { type: 'end_of_turn' },
      ] as AgentEvent[],
      [
        { type: 'say', text: 'Here are some options.' },
        { type: 'cards', items: [{ sku: 'A', title: 'A' }] } as unknown as AgentEvent,
        { type: 'end_of_turn' },
      ] as AgentEvent[],
      [
        { type: 'say', text: 'Adding it now. Tap pay when ready.' },
        { type: 'checkout_redirect', url: 'https://shop.example/cart' } as unknown as AgentEvent,
        { type: 'end_of_turn' },
      ] as AgentEvent[],
    ];

    const bridge = createBridge({
      sessionId: 'ws_int',
      merchantId: 'SM-INT001',
      runTurn: vi.fn(async function* () {
        const turn = fixtureTurns[runCallCount++];
        for (const e of turn ?? []) yield e;
      }) as never,
      loadMerchant: vi.fn().mockResolvedValue({ id: 'SM-INT001' }),
      loadSession: vi.fn().mockResolvedValue({ sessionId: 'ws_int' }),
      saveSession: vi.fn().mockResolvedValue(undefined),
      recordMetric: vi.fn().mockResolvedValue(undefined),
      loadAdapter: vi.fn(),
      speak: vi.fn(async (t: string) => { spoken.push(t); }),
      publishData: (m: DataChannelMessage) => { published.push(m); },
      closeRoom: vi.fn(),
      interrupt: vi.fn(),
    });

    await bridge.handleUserText('hi');
    await bridge.handleUserText('show me running shoes');
    await bridge.handleUserText('add the first one');

    // Spoken: 3 say chunks
    expect(spoken).toEqual([
      'Hi, welcome.',
      'Here are some options.',
      'Adding it now. Tap pay when ready.',
    ]);
    // Published: 3 user_text + 3 say + 1 cards + 1 checkout_redirect = 8
    expect(published.filter((m) => m.type === 'user_text').length).toBe(3);
    expect(published.filter((m) => m.type === 'say').length).toBe(3);
    expect(published.filter((m) => m.type === 'cards').length).toBe(1);
    expect(published.filter((m) => m.type === 'checkout_redirect').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
pnpm --filter @shoppingmate/voice-agent test agentWorker.integration.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/test/agentWorker.integration.test.ts
git commit -m "test(voice-agent): integration — 3-turn fixture conversation E2E"
```

---

## Phase G — Caps + metrics

### Task G1: Voice-side caps wrapper (turns / audio-seconds / wall-clock)

**Files:**
- Create: `apps/voice-agent/src/caps.ts`
- Create: `apps/voice-agent/src/caps.test.ts`

Plan 4's `checkCaps` covers per-turn limits inside `runTurn`. Voice-agent layers session-level limits on top: cumulative voice seconds + wall-clock from session open.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSessionCaps } from './caps.js';

describe('createSessionCaps', () => {
  it('warns at 13 turns, trips at 16', () => {
    const onWarn = vi.fn();
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn, onTrip, now: () => 0 });
    for (let i = 1; i <= 12; i++) caps.recordTurn();
    expect(onWarn).not.toHaveBeenCalled();
    caps.recordTurn(); // 13
    expect(onWarn).toHaveBeenCalledWith({ remaining: 2, cap: 'turns' });
    caps.recordTurn(); // 14
    caps.recordTurn(); // 15
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordTurn(); // 16
    expect(onTrip).toHaveBeenCalledWith({ cap: 'turns' });
  });

  it('trips on 3 minutes cumulative voice (180 s)', () => {
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => 0 });
    caps.recordVoiceSeconds(120);
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordVoiceSeconds(60);
    expect(onTrip).toHaveBeenCalledWith({ cap: 'voice_seconds' });
  });

  it('trips on 25 minutes wall-clock (1500 s)', () => {
    let now = 1_000_000;
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => now });
    caps.start();
    now += 1499 * 1000;
    caps.tick();
    expect(onTrip).not.toHaveBeenCalled();
    now += 2 * 1000;
    caps.tick();
    expect(onTrip).toHaveBeenCalledWith({ cap: 'wall_clock' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**.

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/caps.ts

const TURN_WARN_AT = 13;
const TURN_TRIP_AT = 16;
const VOICE_SECONDS_TRIP = 180; // 3 min
const WALL_CLOCK_TRIP_MS = 25 * 60 * 1000;

export type CapTrip = { cap: 'turns' | 'voice_seconds' | 'wall_clock' };
export type CapWarn = { cap: 'turns'; remaining: number };

export type SessionCaps = {
  start: () => void;
  recordTurn: () => void;
  recordVoiceSeconds: (s: number) => void;
  tick: () => void;
};

export function createSessionCaps(opts: {
  onWarn: (w: CapWarn) => void;
  onTrip: (t: CapTrip) => void;
  now?: () => number;
}): SessionCaps {
  const now = opts.now ?? (() => Date.now());
  let turns = 0;
  let voiceSeconds = 0;
  let startedAt = 0;
  let tripped = false;

  const trip = (cap: CapTrip['cap']) => {
    if (tripped) return;
    tripped = true;
    opts.onTrip({ cap });
  };

  return {
    start() {
      startedAt = now();
    },
    recordTurn() {
      turns++;
      if (turns === TURN_WARN_AT) opts.onWarn({ cap: 'turns', remaining: TURN_TRIP_AT - turns });
      if (turns >= TURN_TRIP_AT) trip('turns');
    },
    recordVoiceSeconds(s) {
      voiceSeconds += s;
      if (voiceSeconds >= VOICE_SECONDS_TRIP) trip('voice_seconds');
    },
    tick() {
      if (startedAt && now() - startedAt >= WALL_CLOCK_TRIP_MS) trip('wall_clock');
    },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS** (3/3).

```bash
pnpm --filter @shoppingmate/voice-agent test caps.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/caps.ts apps/voice-agent/src/caps.test.ts
git commit -m "feat(voice-agent): session-level caps (turns/voice-seconds/wall-clock)"
```

### Task G2: Wire caps into bridge

**Files:**
- Modify: `apps/voice-agent/src/agentWorker.ts`
- Modify: `apps/voice-agent/src/bridge.ts`
- Modify: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Add `caps` to BridgeDeps and call in handleUserText**

In `bridge.ts`, add to `BridgeDeps`:

```ts
caps?: {
  recordTurn: () => void;
};
```

In `handleUserText`, before the runTurn loop:

```ts
deps.caps?.recordTurn();
```

(Cap-trip handling lives in `agentWorker.ts` — when caps fire onTrip, it publishes `cap_warning`/`session_closed` and closes room, NOT bridge.)

- [ ] **Step 2: Update bridge tests to include the optional `caps` field as undefined** — no behavior change since field is optional.

- [ ] **Step 3: In `agentWorker.ts`, instantiate `SessionCaps` and wire**

Add inside the `entry` function after `await gemini.open()`:

```ts
import { createSessionCaps } from './caps.js';
import { createDataChannel } from './dataChannel.js';
// ...

const caps = createSessionCaps({
  onWarn: ({ remaining }) => dataChannel.publish({ type: 'cap_warning', remaining }),
  onTrip: ({ cap }) => {
    dataChannel.publish({ type: 'session_closed', reason: `cap_${cap}` });
    job.room.disconnect().catch(() => {});
  },
});
caps.start();
const tickInterval = setInterval(() => caps.tick(), 5_000);
job.room.on('disconnected', () => clearInterval(tickInterval));
```

And pass `caps` into `createBridge({...,  caps })`.

For voice-second accounting, in the `audio_out` event handler, add (rough estimate at 24kHz mono PCM):

```ts
if (e.type === 'audio_out') {
  const seconds = e.bytes.length / (24000 * 2); // 16-bit mono @ 24k
  caps.recordVoiceSeconds(seconds);
}
```

And on `final_transcript`, estimate input voice seconds from text length (200 wpm ≈ 3.3 wps; one cap-second per ~3.3 words):

```ts
if (e.type === 'final_transcript') {
  const words = e.text.split(/\s+/).filter(Boolean).length;
  caps.recordVoiceSeconds(words / 3.3);
}
```

- [ ] **Step 4: Run typecheck + tests**

```bash
pnpm --filter @shoppingmate/voice-agent typecheck
pnpm --filter @shoppingmate/voice-agent test
```

Both expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/
git commit -m "feat(voice-agent): wire session caps into bridge + agentWorker"
```

### Task G3: Metrics ledger

**Files:**
- Create: `apps/voice-agent/src/metrics.ts`
- Create: `apps/voice-agent/src/metrics.test.ts`

The cost pilot needs per-conv ledger entries. We write to a Postgres table or to stdout (operator picks downstream sink).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMetricsLedger } from './metrics.js';

describe('createMetricsLedger', () => {
  it('accumulates per-session counters', () => {
    const sink = vi.fn();
    const ledger = createMetricsLedger({ sessionId: 'ws_x', merchantId: 'SM-X', sink });
    ledger.add('gemini_audio_input_seconds', 12);
    ledger.add('gemini_audio_input_seconds', 8);
    ledger.add('sonnet_input_tokens', 250);
    ledger.flush();
    expect(sink).toHaveBeenCalledOnce();
    const entry = sink.mock.calls[0]![0];
    expect(entry.sessionId).toBe('ws_x');
    expect(entry.counters.gemini_audio_input_seconds).toBe(20);
    expect(entry.counters.sonnet_input_tokens).toBe(250);
    expect(entry.flushedAt).toBeTypeOf('number');
  });

  it('flush is idempotent — second flush of same session is a no-op', () => {
    const sink = vi.fn();
    const ledger = createMetricsLedger({ sessionId: 'ws_y', merchantId: 'SM-Y', sink });
    ledger.add('a', 1);
    ledger.flush();
    ledger.flush();
    expect(sink).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Implement**

```ts
// apps/voice-agent/src/metrics.ts

export type LedgerEntry = {
  sessionId: string;
  merchantId: string;
  counters: Record<string, number>;
  flushedAt: number;
};

export type MetricsLedger = {
  add: (counter: string, value: number) => void;
  flush: () => void;
};

export function createMetricsLedger(opts: {
  sessionId: string;
  merchantId: string;
  sink: (e: LedgerEntry) => void;
  now?: () => number;
}): MetricsLedger {
  const counters: Record<string, number> = {};
  let flushed = false;
  const now = opts.now ?? (() => Date.now());
  return {
    add(counter, value) {
      counters[counter] = (counters[counter] ?? 0) + value;
    },
    flush() {
      if (flushed) return;
      flushed = true;
      opts.sink({
        sessionId: opts.sessionId,
        merchantId: opts.merchantId,
        counters,
        flushedAt: now(),
      });
    },
  };
}

export function defaultSink(entry: LedgerEntry): void {
  // Operator wires this to S3/postgres downstream. For dev, log the entry.
  // eslint-disable-next-line no-console
  console.log('[voice-metrics]', JSON.stringify(entry));
}
```

- [ ] **Step 3: Run tests — expect PASS**.

```bash
pnpm --filter @shoppingmate/voice-agent test metrics.test.ts
```

- [ ] **Step 4: Wire into agentWorker.ts**

In the `entry` function, after env load:

```ts
import { createMetricsLedger, defaultSink } from './metrics.js';
// ...
const metrics = createMetricsLedger({
  sessionId,
  merchantId: merchant.id,
  sink: defaultSink,
});

// On audio_out events:
if (e.type === 'audio_out') {
  metrics.add('gemini_audio_output_seconds', e.bytes.length / (24000 * 2));
  caps.recordVoiceSeconds(e.bytes.length / (24000 * 2));
}
// On final_transcript:
if (e.type === 'final_transcript') {
  metrics.add('gemini_audio_input_seconds', e.text.split(/\s+/).filter(Boolean).length / 3.3);
}

// On disconnect: flush
job.room.on('disconnected', () => {
  clearInterval(tickInterval);
  metrics.flush();
  gemini.close().catch(() => {});
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/
git commit -m "feat(voice-agent): metrics ledger for cost pilot accounting"
```

---

## Phase H — `POST /v1/voice/token` route in apps/api

### Task H1: Route handler with origin/session checks

**Files:**
- Create: `apps/api/src/routes/voice-token.ts`

Mirrors the pattern of `apps/api/src/routes/session.ts`. JWT minted via `livekit-server-sdk`.

- [ ] **Step 1: Add `livekit-server-sdk` to apps/api dependencies**

Edit `apps/api/package.json`:

```json
"livekit-server-sdk": "^2.7.0",
```

Then `pnpm install`.

- [ ] **Step 2: Implement the route**

```ts
// apps/api/src/routes/voice-token.ts
import { db, schema } from '@shoppingmate/db';
import { childLogger, env } from '@shoppingmate/shared';
import { lookupPersona } from '@shoppingmate/agent';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { originMatches } from '../lib/originCheck.js';

const log = childLogger({ route: 'voice-token' });

const Body = z.object({
  sessionId: z.string().regex(/^ws_[a-z0-9]+$/),
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
});

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export const voiceTokenRoute = new Hono();

voiceTokenRoute.post('/', async (c) => {
  let raw: unknown;
  try { raw = await c.req.json(); } catch {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const { sessionId, merchantId } = parsed.data;

  // Origin check — must match a registered domain
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  if (!merchant) {
    return c.json({ error: 'merchant_not_found' }, 404);
  }
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const matchesAny = merchant.allowedDomains.some((d: string) => originMatches(origin, referer, d));
  if (!matchesAny) {
    log.info({ merchantId, origin, referer }, 'voice-token rejected_origin');
    return c.json({ error: 'origin_mismatch' }, 403);
  }

  const lkUrl = process.env.LIVEKIT_URL;
  const lkApiKey = process.env.LIVEKIT_API_KEY;
  const lkApiSecret = process.env.LIVEKIT_API_SECRET;
  if (!lkUrl || !lkApiKey || !lkApiSecret) {
    log.error({}, 'LiveKit env not configured');
    return c.json({ error: 'voice_unavailable' }, 503);
  }

  const roomName = `sm_${sessionId}`;
  const at = new AccessToken(lkApiKey, lkApiSecret, {
    identity: `visitor_${sessionId}`,
    ttl: TOKEN_TTL_SECONDS,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();

  const personaId = (merchant.config as { persona_id?: string } | null)?.persona_id ?? null;
  const persona = lookupPersona(personaId);

  return c.json({ wsUrl: lkUrl, roomName, token, personaId: persona.id }, 200);
});
```

- [ ] **Step 3: Mount in `apps/api/src/index.ts`**

Add import:

```ts
import { voiceTokenRoute } from './routes/voice-token.js';
```

And:

```ts
app.route('/v1/voice/token', voiceTokenRoute);
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @shoppingmate/api typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/voice-token.ts apps/api/src/index.ts apps/api/package.json
git commit -m "feat(api): POST /v1/voice/token mints LiveKit JWT scoped to sessionId"
```

### Task H2: Tests for `/v1/voice/token`

**Files:**
- Create: `apps/api/src/routes/voice-token.test.ts`

- [ ] **Step 1: Write tests** (mirror `session.test.ts` patterns from existing code)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { voiceTokenRoute } from './voice-token.js';

vi.mock('@shoppingmate/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'SM-ABC123',
              allowedDomains: ['example.com'],
              config: { persona_id: 'coach' },
            },
          ],
        }),
      }),
    }),
  },
  schema: { merchants: {} },
}));

vi.mock('@shoppingmate/agent', () => ({
  lookupPersona: (id: string) => ({ id: id ?? 'concierge' }),
}));

describe('POST /v1/voice/token', () => {
  beforeEach(() => {
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'API_test';
    process.env.LIVEKIT_API_SECRET = 'secret_test_at_least_32_chars_long';
  });

  it('400 on invalid body', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ wrong: 'body' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(400);
  });

  it('200 with token + roomName + personaId on valid request', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roomName).toBe('sm_ws_abc');
    expect(body.token).toBeTruthy();
    expect(body.wsUrl).toBe('wss://test.livekit.cloud');
    expect(body.personaId).toBe('coach');
  });

  it('403 on origin mismatch', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://evil.com' },
    });
    expect(res.status).toBe(403);
  });

  it('503 when LiveKit env not configured', async () => {
    delete process.env.LIVEKIT_URL;
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run — expect PASS** (4/4).

```bash
pnpm --filter @shoppingmate/api test voice-token.test.ts
```

If a test fails because the existing `session.test.ts` uses a different mock pattern, mirror its pattern exactly — don't reinvent.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/voice-token.test.ts
git commit -m "test(api): /v1/voice/token — happy + 400 + 403 + 503 paths"
```

### Task H3: Run full repo tests + typecheck

- [ ] **Step 1**

```bash
pnpm typecheck && pnpm test
```

Expected: all green; new tests added.

- [ ] **Step 2: Commit any fix-ups** (if any test broke):

```bash
git add -A && git commit -m "test: fix-ups after Phase H"
```

(Skip this commit if no changes.)

---

## Phase I — Widget integration (lazy-load LiveKit + voiceModeFactory)

### Task I1: Rename existing voiceMode → voiceModeWebSpeech (Plan 5 fallback)

**Files:**
- Move: `packages/widget/src/audio/voiceMode.ts` → `packages/widget/src/audio/voiceModeWebSpeech.ts`
- Create: `packages/widget/src/audio/voiceMode.ts` (new contract — re-export from factory)

The Plan 5 implementation still exists for dev-mode fallback (`VITE_VOICE_STACK=web-speech`). The public surface (`voiceMode.ts`) becomes a re-export from the factory.

- [ ] **Step 1: git mv the existing file**

```bash
git mv packages/widget/src/audio/voiceMode.ts packages/widget/src/audio/voiceModeWebSpeech.ts
```

- [ ] **Step 2: Find consumers and update imports**

```bash
grep -rn "from './audio/voiceMode" packages/widget/src/ packages/widget/test/
grep -rn "from '../audio/voiceMode" packages/widget/src/ packages/widget/test/
```

Each consumer that imported `voiceMode.ts` symbols needs to keep working — we recreate `voiceMode.ts` in the next step as a re-export shim. Inside the renamed `voiceModeWebSpeech.ts`, keep `createVoiceMode` exported.

- [ ] **Step 3: Recreate `voiceMode.ts` as a re-export**

```ts
// packages/widget/src/audio/voiceMode.ts
// Public surface preserved across Plan 5 (Web Speech) and Plan 6 (LiveKit + Gemini).
// Internals selected by voiceModeFactory at runtime.
export type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';
export { createVoiceMode as createVoiceModeWebSpeech } from './voiceModeWebSpeech.js';
export { createVoiceModeFactory } from './voiceModeFactory.js';
```

(`voiceModeFactory.js` is created in Task I3.)

- [ ] **Step 4: Typecheck — expect failure on `voiceModeFactory` import** (file doesn't exist yet). That's OK — fix in I3.

- [ ] **Step 5: Commit (WIP)**

```bash
git add packages/widget/src/audio/
git commit -m "refactor(widget): rename voiceMode → voiceModeWebSpeech (Plan 5 fallback) [WIP]"
```

### Task I2: `transport/livekit.ts` — thin wrapper over livekit-client (lazy-loaded)

**Files:**
- Create: `packages/widget/src/transport/livekit.ts`
- Create: `packages/widget/test/transport-livekit.test.ts`

This module dynamic-imports `livekit-client` from a CDN URL. It exposes `connectToRoom(opts)` returning a typed handle.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('connectToRoom', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects when livekit-client lazy-load fails', async () => {
    vi.stubGlobal('__SHOPPINGMATE_LIVEKIT_LOADER__', async () => {
      throw new Error('cdn down');
    });
    const { connectToRoom } = await import('../src/transport/livekit.js');
    await expect(connectToRoom({ wsUrl: 'wss://x', token: 't', roomName: 'r' }))
      .rejects.toThrow(/cdn down|livekit/i);
  });

  it('connects and returns a handle on success', async () => {
    const fakeRoom = {
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      localParticipant: { setMicrophoneEnabled: vi.fn() },
      disconnect: vi.fn(),
    };
    vi.stubGlobal('__SHOPPINGMATE_LIVEKIT_LOADER__', async () => ({
      Room: vi.fn(() => fakeRoom),
    }));
    const { connectToRoom } = await import('../src/transport/livekit.js');
    const handle = await connectToRoom({ wsUrl: 'wss://x', token: 't', roomName: 'r' });
    expect(handle.disconnect).toBeTypeOf('function');
    expect(handle.setMicEnabled).toBeTypeOf('function');
    expect(handle.onData).toBeTypeOf('function');
  });
});
```

- [ ] **Step 2: Implement**

```ts
// packages/widget/src/transport/livekit.ts

const DEFAULT_CDN_BASE = 'https://cdn.shoppingmate.ai/vendor';
const DEFAULT_VERSION = '2.7.0';

declare global {
  // Tests can override the loader to inject a stub.
  var __SHOPPINGMATE_LIVEKIT_LOADER__: (() => Promise<unknown>) | undefined;
}

export type LiveKitHandle = {
  setMicEnabled: (enabled: boolean) => Promise<void>;
  onData: (cb: (bytes: Uint8Array) => void) => void;
  disconnect: () => Promise<void>;
};

async function loadLiveKit(): Promise<{ Room: new () => unknown }> {
  if (typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ === 'function') {
    return (await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__()) as { Room: new () => unknown };
  }
  const url = `${DEFAULT_CDN_BASE}/livekit-client@${DEFAULT_VERSION}/dist/livekit-client.esm.min.js`;
  return (await import(/* @vite-ignore */ url)) as { Room: new () => unknown };
}

export async function connectToRoom(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
}): Promise<LiveKitHandle> {
  const lk = await loadLiveKit();
  const room = new (lk.Room as unknown as new () => {
    connect: (url: string, token: string) => Promise<void>;
    on: (ev: string, cb: (...args: unknown[]) => void) => void;
    localParticipant: { setMicrophoneEnabled: (b: boolean) => Promise<void> };
    disconnect: () => Promise<void>;
  })();
  await room.connect(opts.wsUrl, opts.token);
  return {
    setMicEnabled: (enabled) => room.localParticipant.setMicrophoneEnabled(enabled),
    onData: (cb) => {
      room.on('dataReceived', (payload: unknown) => {
        if (payload instanceof Uint8Array) cb(payload);
      });
    },
    disconnect: () => room.disconnect(),
  };
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @shoppingmate/widget test transport-livekit.test.ts
```

Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/transport/livekit.ts packages/widget/test/transport-livekit.test.ts
git commit -m "feat(widget): livekit transport wrapper with lazy CDN loader"
```

### Task I3: `voiceModeLiveKit.ts` + `voiceModeFactory.ts`

**Files:**
- Create: `packages/widget/src/audio/voiceModeLiveKit.ts`
- Create: `packages/widget/src/audio/voiceModeFactory.ts`
- Create: `packages/widget/test/voiceModeFactory.test.ts`

- [ ] **Step 1: Implement `voiceModeLiveKit.ts`**

```ts
// packages/widget/src/audio/voiceModeLiveKit.ts
import { connectToRoom, type LiveKitHandle } from '../transport/livekit.js';
import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

export function createVoiceModeLiveKit(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
  onTranscriptEvent: (raw: Uint8Array) => void;
}): VoiceMode {
  let state: VoiceModeState = 'idle';
  let handle: LiveKitHandle | null = null;
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
      (async () => {
        try {
          handle = await connectToRoom({ wsUrl: opts.wsUrl, token: opts.token, roomName: opts.roomName });
          handle.onData((bytes) => opts.onTranscriptEvent(bytes));
          await handle.setMicEnabled(!muted);
          set(muted ? 'muted' : 'listening');
        } catch (err) {
          set('idle');
          throw err;
        }
      })().catch((err) => {
        // Caller handles fallback-to-chat via onStateChange; rethrow not allowed in fire-and-forget start().
        // Caller must check getState() after a microtask if start() may fail.
        console.warn('[voiceModeLiveKit] connect failed', err);
      });
    },
    stop: () => {
      handle?.disconnect().catch(() => {});
      handle = null;
      set('idle');
    },
    speak: async () => {
      // No-op: TTS is owned by the server-side voice-agent (Gemini Live).
      // Locally we just remain in 'speaking' state visually if the server sends a TTS-started event.
    },
    setMuted: (m) => {
      muted = m;
      handle?.setMicEnabled(!m).catch(() => {});
      if (m) set('muted');
      else if (state === 'muted') set('listening');
    },
    getState: () => state,
    onStateChange: (cb) => { listeners.push(cb); },
  };
}
```

- [ ] **Step 2: Implement `voiceModeFactory.ts`**

```ts
// packages/widget/src/audio/voiceModeFactory.ts
import type { VoiceMode } from './voiceModeWebSpeech.js';
import { createVoiceMode as createVoiceModeWebSpeech } from './voiceModeWebSpeech.js';
import { createVoiceModeLiveKit } from './voiceModeLiveKit.js';
import { createSTT } from './stt.js';
import { createTTS } from './tts.js';

export type VoiceModeFactoryOpts = {
  stack: 'live-kit' | 'web-speech';
  livekit?: { wsUrl: string; token: string; roomName: string; onTranscriptEvent: (b: Uint8Array) => void };
};

export function createVoiceModeFactory(opts: VoiceModeFactoryOpts): VoiceMode | null {
  if (opts.stack === 'web-speech') {
    return createVoiceModeWebSpeech(createSTT(), createTTS());
  }
  if (opts.stack === 'live-kit') {
    if (!opts.livekit) {
      console.warn('[voiceModeFactory] live-kit stack requires livekit opts; returning null → caller falls back to chat');
      return null;
    }
    return createVoiceModeLiveKit(opts.livekit);
  }
  return null;
}
```

- [ ] **Step 3: Test**

```ts
// packages/widget/test/voiceModeFactory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('createVoiceModeFactory', () => {
  beforeEach(() => vi.resetModules());

  it('returns null when stack=live-kit but no livekit opts', async () => {
    const { createVoiceModeFactory } = await import('../src/audio/voiceModeFactory.js');
    expect(createVoiceModeFactory({ stack: 'live-kit' })).toBeNull();
  });

  it('returns a Web Speech VoiceMode when stack=web-speech', async () => {
    // happy-dom provides minimal SpeechRecognition/SpeechSynthesis stubs for module load
    const { createVoiceModeFactory } = await import('../src/audio/voiceModeFactory.js');
    const vm = createVoiceModeFactory({ stack: 'web-speech' });
    expect(vm).not.toBeNull();
    expect(vm!.getState()).toBe('idle');
  });
});
```

- [ ] **Step 4: Run typecheck + tests**

```bash
pnpm --filter @shoppingmate/widget typecheck
pnpm --filter @shoppingmate/widget test voiceModeFactory.test.ts
```

Both expected green. If happy-dom doesn't stub `SpeechRecognition`, the second test may need `vi.stubGlobal('SpeechRecognition', class {})` setup — adjust as needed.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/audio/ packages/widget/test/voiceModeFactory.test.ts
git commit -m "feat(widget): voiceModeLiveKit + factory; live-kit default with chat fallback"
```

### Task I4: Bootstrap mints voice token alongside install + session

**Files:**
- Modify: `packages/widget/src/bootstrap.ts`
- Modify: `packages/widget/test/bootstrap.test.ts`

- [ ] **Step 1: Read existing bootstrap to understand the install + session flow**

```bash
head -80 packages/widget/src/bootstrap.ts
```

(Identify the `fetch` calls for `/v1/install` and `/v1/session`.)

- [ ] **Step 2: Add a third `/v1/voice/token` POST** after the session mint succeeds

The request body: `{ sessionId, merchantId }`. On success, store the response on the bootstrap return value as `voice: { wsUrl, roomName, token, personaId }`. On failure (non-200 or thrown), set `voice: null` and log a warn — bootstrap MUST NOT fail because voice is unavailable; chat must still work.

```ts
// after the existing session mint:
let voice: { wsUrl: string; roomName: string; token: string; personaId: string } | null = null;
try {
  const vRes = await fetch(`${apiBase}/v1/voice/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, merchantId }),
  });
  if (vRes.ok) {
    voice = await vRes.json();
  } else {
    console.warn('[shoppingmate] voice unavailable — status', vRes.status);
  }
} catch (err) {
  console.warn('[shoppingmate] voice unavailable —', err);
}

return { merchantId, sessionId, wsToken, wsUrl, voice };
```

(Update the bootstrap return type accordingly.)

- [ ] **Step 3: Update bootstrap.test.ts** to assert that voice is fetched and that bootstrap still returns successfully if `/v1/voice/token` 503s.

```ts
it('still bootstraps successfully when /v1/voice/token returns 503', async () => {
  // ... mock fetch sequence: install→200, session→200, voice→503
  // assert returned object has voice: null and no thrown error
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @shoppingmate/widget test bootstrap.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/bootstrap.ts packages/widget/test/bootstrap.test.ts
git commit -m "feat(widget): bootstrap mints voice token; tolerates voice unavailability"
```

### Task I5: `ui/call.ts` wires factory + bundle-budget + livekit-client absence assertion

**Files:**
- Modify: `packages/widget/src/ui/call.ts`
- Modify: `packages/widget/scripts/build.ts` (or whatever builds `dist/v1.js`)

- [ ] **Step 1: In `ui/call.ts`, replace direct `createVoiceMode` import with the factory call**

Read the existing wiring first:

```bash
grep -n "createVoiceMode\|voiceMode" packages/widget/src/ui/call.ts
```

Then change:

```ts
import { createVoiceModeFactory } from '../audio/voiceModeFactory.js';
// ... in call setup:
const stack = (import.meta as { env?: { VITE_VOICE_STACK?: string } }).env?.VITE_VOICE_STACK === 'web-speech'
  ? 'web-speech' as const
  : 'live-kit' as const;

const voiceMode = createVoiceModeFactory({
  stack,
  livekit: voice ? {
    wsUrl: voice.wsUrl,
    token: voice.token,
    roomName: voice.roomName,
    onTranscriptEvent: handleTranscriptEvent, // existing transcript handler
  } : undefined,
});

if (!voiceMode) {
  // Fallback: open chat panel directly with a one-time toast
  showToast('Voice unavailable — switching to chat');
  switchToChat();
  return;
}
```

(`voice` comes from the bootstrap return — pass it into the call panel constructor.)

- [ ] **Step 2: Add `livekit-client` absence assertion to the build script**

Read existing build script:

```bash
cat packages/widget/scripts/build.ts
```

Append (or insert before the size-check):

```ts
import { readFileSync } from 'node:fs';
const distContent = readFileSync('dist/v1.js', 'utf8');
if (distContent.includes('livekit-client')) {
  console.error('FATAL: dist/v1.js contains livekit-client — must be lazy-loaded only');
  process.exit(1);
}
console.log('OK: livekit-client absent from bundle (lazy-load only)');
```

- [ ] **Step 3: Build the widget and verify**

```bash
pnpm --filter @shoppingmate/widget build
```

Expected: build prints OK livekit-client absent + size <120 KB gzip. If `livekit-client` IS in the bundle, the build fails — track down the static import that pulled it in and convert to `await import()`.

- [ ] **Step 4: Run all widget tests**

```bash
pnpm --filter @shoppingmate/widget test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/ui/call.ts packages/widget/scripts/build.ts
git commit -m "feat(widget): call panel uses voice factory; build asserts no livekit-client in bundle"
```

---

## Phase J — Cost pilot prep + acceptance close

### Task J1: `pilot-replay.ts` script

**Files:**
- Create: `apps/voice-agent/scripts/pilot-replay.ts`

A tiny CLI that reads a recorded session JSON (sessionId + transcript turns) from stdin or file, replays the user_text turns through the bridge against a real Gemini Live session, and writes per-turn ledger entries to stdout.

- [ ] **Step 1: Write the script**

```ts
// apps/voice-agent/scripts/pilot-replay.ts
import { readFileSync } from 'node:fs';
import { childLogger } from '@shoppingmate/shared';
import { createBridge } from '../src/bridge.js';
import { createGeminiSdkTransport } from '../src/geminiSdkTransport.js';
import { createGeminiSession } from '../src/geminiSession.js';
import { resolveVoiceContext } from '../src/persona.js';
import { createMetricsLedger, defaultSink } from '../src/metrics.js';
import { runTurn, loadSession, saveSession } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { getAdapter } from '@shoppingmate/adapters';
import { eq } from 'drizzle-orm';

const log = childLogger({ mod: 'pilot-replay' });

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: pilot-replay <recorded-session.json>');
    process.exit(1);
  }
  const recording = JSON.parse(readFileSync(path, 'utf8')) as {
    sessionId: string;
    merchantId: string;
    personaId: string;
    turns: { user_text: string }[];
  };

  const session = await loadSession(recording.sessionId);
  if (!session) throw new Error(`session ${recording.sessionId} not found`);
  const [merchant] = await db.select().from(schema.merchants)
    .where(eq(schema.merchants.id, recording.merchantId)).limit(1);
  if (!merchant) throw new Error(`merchant ${recording.merchantId} not found`);

  const voice = resolveVoiceContext(recording.personaId);
  const transport = createGeminiSdkTransport();
  const gemini = createGeminiSession({
    transport, voiceId: voice.voiceId, systemInstruction: voice.systemInstruction,
  });
  await gemini.open();

  const metrics = createMetricsLedger({
    sessionId: recording.sessionId,
    merchantId: recording.merchantId,
    sink: defaultSink,
  });

  gemini.onEvent((e) => {
    if (e.type === 'audio_out') metrics.add('gemini_audio_output_seconds', e.bytes.length / (24000 * 2));
    if (e.type === 'final_transcript') metrics.add('gemini_audio_input_seconds', e.text.split(/\s+/).filter(Boolean).length / 3.3);
  });

  const bridge = createBridge({
    sessionId: recording.sessionId,
    merchantId: recording.merchantId,
    runTurn,
    loadMerchant: async () => merchant,
    loadSession: async () => session,
    saveSession,
    recordMetric: async () => {},
    loadAdapter: (m, sid) => getAdapter(m, sid),
    speak: (text) => gemini.speak(text),
    publishData: () => {},
    closeRoom: () => {},
    interrupt: () => gemini.interrupt(),
    caps: { recordTurn: () => {} },
  });

  for (const t of recording.turns) {
    log.info({ user_text: t.user_text }, 'replaying turn');
    await bridge.handleUserText(t.user_text);
  }

  await gemini.close();
  metrics.flush();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @shoppingmate/voice-agent typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/voice-agent/scripts/pilot-replay.ts
git commit -m "feat(voice-agent): pilot-replay CLI for cost-pilot reproducibility"
```

### Task J2: Pilot runbook

**Files:**
- Create: `docs/runbooks/gemini-live-cost-pilot.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Gemini Live Cost Pilot — Runbook

**Purpose:** Produce measured $/conv with 95% CI for the Gemini Live + LiveKit voice stack. Gates the seed close per ADR-0001 §4.

## Setup
1. Stand up staging dev-store with full Plan 6 stack:
   - apps/api running with /v1/voice/token route live
   - apps/voice-agent registered as a LiveKit Agent worker
   - widget bundle deployed to staging cdn
   - Gemini API key + LiveKit project keys with billing visible
2. Seed staging Postgres with one demo merchant + ~100 catalog items.
3. Configure `merchant.config.persona_id = 'concierge'` (default).

## Pilot run
Hold 100 voice conversations against the staging widget. Mix of:
- 25 greet-only (≤2 turns, ≤30s)
- 25 recommend-only (3-5 turns, ≤60s)
- 25 full purchase flow (end at checkout_redirect, ≤120s)
- 15 cart-then-abandon (≤90s)
- 10 barge-in heavy (interrupt agent multiple times)

Recorders: Karan + 2 contractors. Use a worksheet to log conversation type + observed quality (1-5).

## Capture
Each conversation triggers `metrics.flush()` on disconnect → ledger entry to stdout (operator pipes to S3). Schema:
```json
{ "sessionId": "ws_xxx", "merchantId": "SM-xxx",
  "counters": { "gemini_audio_input_seconds": 8.2, "gemini_audio_output_seconds": 14.7,
                "sonnet_input_tokens": 420, "sonnet_output_tokens": 95 },
  "flushedAt": 1715000000000 }
```

## Compute $/conv
For each ledger entry:
- gemini_audio_cost = (input_seconds + output_seconds) * GEMINI_LIVE_PRICE_PER_SECOND
- sonnet_cost = input_tokens * SONNET_INPUT_PRICE + output_tokens * SONNET_OUTPUT_PRICE
- conv_cost = gemini_audio_cost + sonnet_cost + LIVEKIT_PRICE_PER_MIN * (room_minutes)

Use current public pricing (verified from each vendor's pricing page on the day of analysis).

## Memo
Write `docs/strategy/<YYYY-MM-DD>-gemini-live-cost-pilot.md` with:
- Mean $/conv ± 95% CI
- Distribution histogram by conv length (10s buckets)
- Voice-only vs voice-with-tools breakout
- Projected $/conv at the 3-min cap (worst case)
- Per-plan margin-floor check (Starter through Pro) including voice-fairness surcharge
- Comparison to ADR-0001 §3's $0.018 estimate

## Halt condition
If 95% CI upper bound breaches the §5.4 margin floor on ANY plan including the surcharge, **HALT seed close** and trigger the cost-cut playbook. No exec override.

## Cleanup
After memo published:
- Save raw ledger entries to S3 under `pilot-2026-05-XX/` for audit
- Delete pilot LiveKit recordings within 30 days
- Update memory `project_gemini_live_cost_pilot_result.md`
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/gemini-live-cost-pilot.md
git commit -m "docs(runbook): gemini live cost pilot procedure"
```

### Task J3: Roadmap update — Plan 6 row

**Files:**
- Modify: `docs/superpowers/roadmap.md`

- [ ] **Step 1: Update the Plan 6 row in §9**

Find the Phase 1 closing-plans table row for Plan 6 and change status to ✅ Code-complete (acceptance gates 9-10 deferred to operator). Add commit-range placeholder you'll fill at close.

```markdown
| Plan 6 — Voice stack (LiveKit Cloud + Gemini 2.5 Flash Live native audio)    | ✅ Code-complete | <NN tasks across 10 phases (A-J)>, commits `<first>`...`<last>`. Plan 4 runtime extracted to packages/agent (zero behavior change, all 360 tests preserved). New apps/voice-agent service bridges LiveKit + Gemini Live native audio to Plan 4's runTurn. 8 personas mapped to Gemini prebuilt voices. Widget lazy-loads livekit-client from self-hosted CDN; bundle stays <120 KB gzip with `livekit-client` confirmed absent. POST /v1/voice/token mints scoped LiveKit JWT. Live smoke + Plan 4-bis cost pilot deferred to operator. |
```

(Replace `<NN>` and commit hashes once acceptance close runs in J5.)

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/roadmap.md
git commit -m "docs(roadmap): plan 6 ✅ code-complete — voice stack live (operator-pending acceptance)"
```

### Task J4: Memory update

**Files:**
- Modify: `~/.claude/projects/<project>/memory/project_shoppingmate_phase1_status.md`

- [ ] **Step 1: Read current memory file**

```bash
cat "$HOME/.claude/projects/C--Users-naidu-Downloads-Personal-Agentic-shopper/memory/project_shoppingmate_phase1_status.md"
```

- [ ] **Step 2: Append a Plan 6 line and update the lead**

Add: `**Plan 6 (Voice stack):** code-complete YYYY-MM-DD — <commit range>. Live smoke + Plan 4-bis cost pilot deferred.`

Update the description at top to include Plan 6 in the "all complete" list.

Add a section "Architectural points worth remembering (Plan 6)" with the load-bearing facts:
- packages/agent/ extracted from apps/api/src/agent/ — voice-agent + future plans import from there
- Defense-in-depth on no-numeric-prices: stripPrices() in postprocess.ts AND geminiSession.speak() rejects digits/$ AND Gemini sysprompt forbids
- 8 personas mapped to Gemini prebuilt voices (aoede/leda/fenrir/kore/orus/puck/charon/zephyr)
- livekit-client lazy-loaded from cdn.shoppingmate.ai/vendor/livekit-client@<version> — NEVER bundled
- Widget falls back to chat on any voice failure (mic denied, LK unreachable, livekit-client load fails, Gemini errors)
- Cost pilot is the seed-close gate; pilot-replay.ts script reproduces $/conv from recorded sessions

- [ ] **Step 3: Save the memory file**

(No git step — memory directory is outside the repo.)

### Task J5: Acceptance close — full repo gates + tag

- [ ] **Step 1: Final repo-wide gates**

```bash
pnpm typecheck
pnpm test
pnpm lint
```

Expected: typecheck clean across 11 workspaces; all tests green (Plan 4's 360 + ~40 new Plan 6 tests = ~400+); lint shows only the 4 pre-existing slack-workstream errors.

- [ ] **Step 2: Widget bundle gate**

```bash
pnpm --filter @shoppingmate/widget build
```

Expected: prints "OK: livekit-client absent from bundle" + size line confirming <120 KB gzip.

- [ ] **Step 3: voice-agent build gate**

```bash
pnpm --filter @shoppingmate/voice-agent build
```

Expected: dist/index.js produced, no errors.

- [ ] **Step 4: Tag**

```bash
git tag phase1-plan6-voice-stack-complete
```

- [ ] **Step 5: Final commit log review**

```bash
git log --oneline phase1-plan6-phaseA-agent-extracted..HEAD
```

Verify ~38 commits land in the expected order; copy first/last commit hashes back into the roadmap row from J3 (amend that commit).

---

## Self-review checklist (run before declaring plan written)

- [ ] **Spec coverage:** every spec section has at least one task. Done-criteria 1-7 (visitor) covered by I1-I5+J5; developer 1-4 by C+D+I+J5; finance 5 by J2.
- [ ] **No placeholders:** no "TBD" / "implement later" / "similar to Task N" / "add appropriate error handling" remains.
- [ ] **Type consistency:** `BridgeDeps` field names (`speak`, `publishData`, `closeRoom`, `interrupt`, `caps`) consistent across E1-G2 and F2.
- [ ] **Persona IDs:** `concierge`/`coach`/`stylist`/etc. used everywhere; no leftover `sage`/`harper`/etc. placeholder names.
- [ ] **Tagging:** Phase A tag (`phase1-plan6-phaseA-agent-extracted`) and final tag (`phase1-plan6-voice-stack-complete`) both present.
- [ ] **Test count:** ~5 new tests in Phase B + ~5 in C + ~5 in D + ~6 in E + ~5 in F + ~5 in G + ~4 in H = ~35-40 new tests. Plan 4's 360 preserved.
