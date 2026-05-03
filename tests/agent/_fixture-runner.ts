// Vitest-aware fixture runner. Wraps `runFixturePure` with a `vi.fn()`-based
// chatTools impl so existing tests can keep using `vi.mocked(chatTools)` for
// per-call assertions, and to preserve the historical surface
// (`chatToolsMock`, `saveSessionMock`, `recordMetricMock`) those tests rely on.
//
// The deterministic core (merchant/session/adapter setup, turn loop) lives in
// `_fixture-runner-pure.ts` and is reused by `packages/cli/src/commands/agentReplay.ts`,
// which runs outside vitest and therefore can't import `vi`.
import { vi } from 'vitest';
import type { AgentEvent, SessionState } from '../../apps/api/src/agent/types.js';
import { fixtureSonnetQueue, loadFixture, runFixturePure } from './_fixture-runner-pure.js';

// Re-export the shared types so callers can keep importing from here.
export type {
  FixtureSonnetResponse,
  FixtureUserTurn,
  FixtureTurn,
  FixtureFile,
} from './_fixture-runner-pure.js';

// Mock @shoppingmate/shared at module load — keeps backward-compat with tests
// that did `await import('@shoppingmate/shared')` and asserted via
// `vi.mocked(chatTools).mock.calls`.
vi.mock('@shoppingmate/shared', async (orig) => ({
  ...(await orig<typeof import('@shoppingmate/shared')>()),
  chatTools: vi.fn(),
}));

const { chatTools } = await import('@shoppingmate/shared');

export type RunFixtureResult = {
  events: AgentEvent[][];
  fixture: import('./_fixture-runner-pure.js').FixtureFile;
  chatToolsMock: ReturnType<typeof vi.mocked<typeof chatTools>>;
  saveSessionMock: ReturnType<typeof vi.fn>;
  recordMetricMock: ReturnType<typeof vi.fn>;
};

export async function runFixture(path: string): Promise<RunFixtureResult> {
  const fixture = loadFixture(path);
  const queue = fixtureSonnetQueue(fixture);

  // Keep the historical `vi.mocked(chatTools)` queue behaviour: each fixture
  // turn enqueues its responses, runtime calls them in order. Existing tests
  // can still inspect call args through `chatToolsMock.mock.calls`.
  const chatToolsMock = vi.mocked(chatTools);
  chatToolsMock.mockReset();
  for (const r of queue) chatToolsMock.mockResolvedValueOnce(r);

  const saveSessionMock = vi.fn(async () => undefined);
  const recordMetricMock = vi.fn(async () => undefined);

  const result = await runFixturePure(path, async (...args) => {
    // Route through the vi mock so tests can assert on call args/order.
    return chatToolsMock(...(args as Parameters<typeof chatTools>));
  });

  // Replay saved sessions / metrics into the mock so tests that inspect
  // `saveSessionMock.mock.calls` keep working.
  for (const s of result.savedSessions) {
    await saveSessionMock(s as SessionState);
  }
  for (const m of result.recordedMetrics) {
    await recordMetricMock(m.name, m.tags, m.value);
  }

  return {
    events: result.events,
    fixture: result.fixture,
    chatToolsMock,
    saveSessionMock,
    recordMetricMock,
  };
}
