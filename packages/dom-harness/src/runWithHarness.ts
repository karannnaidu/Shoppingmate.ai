import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { WSTransport } from '@shoppingmate/adapters';
import { type Harness, startHarness } from './harness.js';
import { signWsToken } from './wsAuth.js';
import { type MountedWs, mountWs } from './wsServer.js';

export type HarnessSetup = {
  transport: WSTransport;
  harness: Harness;
  stop: () => Promise<void>;
};

/**
 * One-stop bring-up of the full DOM transport pipe for offline runs:
 *
 *   http server  ──upgrade──▶  WSS  ──action──▶  Playwright harness
 *                                    ◀──ack──
 *
 * Used by both `pnpm shoppingmate adapter-smoke` (CLI) and the worker
 * onboarding smoke step so they share one wiring path. Caller must `stop()`.
 */
export async function runWithHarness(opts: {
  sessionId: string;
  merchantId: string;
  initialUrl: string;
}): Promise<HarnessSetup> {
  const server: Server = createServer();
  const mounted: MountedWs = mountWs(server);
  await new Promise<void>((res) => {
    server.listen(0, () => res());
  });
  const port = (server.address() as AddressInfo).port;
  const token = signWsToken({
    sessionId: opts.sessionId,
    merchantId: opts.merchantId,
    exp: Date.now() / 1000 + 600,
  });
  const wsUrl = `ws://127.0.0.1:${port}/v1/widget/${opts.sessionId}/ws?token=${token}`;
  const harness = await startHarness({ wsUrl, initialUrl: opts.initialUrl });

  return {
    transport: mounted.transport,
    harness,
    stop: async () => {
      await harness.stop();
      await mounted.close();
      await new Promise<void>((res) => server.close(() => res()));
    },
  };
}
