import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type FixtureUserTurn = unknown;
type AgentEvent = { type: string; text?: string; [k: string]: unknown };

type FixtureRunnerModule = {
  loadFixture: (path: string) => { turns: Array<{ user: FixtureUserTurn }> };
  fixtureSonnetQueue: (fixture: ReturnType<FixtureRunnerModule['loadFixture']>) => unknown[];
  makeQueuedChatTools: (queue: unknown[]) => (...args: unknown[]) => Promise<unknown>;
  runFixturePure: (
    path: string,
    impl: (...args: unknown[]) => Promise<unknown>,
  ) => Promise<{ events: AgentEvent[][] }>;
};

/**
 * Replay an agent fixture file end-to-end against the real `runTurn` runtime
 * with a queued mock `chatTools` impl. Prints turn-by-turn JSON event streams
 * to stdout. Hard-fails (returns 1) if any `say` event contains a numeric
 * price — surfacing the kind of regressions the fixture-driven tests catch
 * but in a one-shot CLI form.
 *
 * Note: this command imports the fixture runner from `tests/agent/`, which
 * is outside the CLI package's `rootDir`. We use a dynamic import with a
 * runtime-computed path (so `tsc` doesn't statically resolve the module
 * graph and reject it for crossing `rootDir`). The CLI is run via `tsx`
 * in dev — no compile step is needed for the dynamic target.
 */
export async function agentReplay(fixturePath: string): Promise<number> {
  const path = resolve(process.cwd(), fixturePath);
  // Compute the import target relative to this source file. `import.meta.url`
  // resolves at runtime (tsx for dev, compiled JS for build), and the string
  // is opaque to `tsc`'s static resolution.
  const runnerUrl = new URL(
    '../../../../tests/agent/_fixture-runner-pure.js',
    import.meta.url,
  );
  // Round-trip through pathToFileURL to keep things explicit on Windows where
  // `\` paths and `file://` semantics need to play well together.
  void pathToFileURL;
  const runner = (await import(runnerUrl.href)) as unknown as FixtureRunnerModule;
  const fixture = runner.loadFixture(path);
  const queue = runner.fixtureSonnetQueue(fixture);
  const chatToolsImpl = runner.makeQueuedChatTools(queue);
  const { events } = await runner.runFixturePure(path, chatToolsImpl);

  for (let i = 0; i < events.length; i += 1) {
    console.log(`# turn ${i + 1}: ${JSON.stringify(fixture.turns[i]?.user)}`);
    for (const ev of events[i]!) console.log(JSON.stringify(ev));
  }

  for (const turn of events) {
    for (const ev of turn) {
      if (
        ev.type === 'say' &&
        typeof ev.text === 'string' &&
        /[\u20B9$]\d|\bRs\.?\s*\d/.test(ev.text)
      ) {
        console.error('FAIL: numeric price found in say event:', ev.text);
        return 1;
      }
    }
  }

  console.log('OK');
  return 0;
}
