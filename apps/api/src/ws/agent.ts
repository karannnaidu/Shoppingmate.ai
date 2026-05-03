import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { verifyWsToken } from '@shoppingmate/dom-harness';
import { type WebSocket, WebSocketServer } from 'ws';

export type AgentWsDeps = {
  /**
   * Called for every inbound text frame on the agent socket. Implementations
   * should parse the frame as a WidgetMessage and stream AgentEvents back
   * via the supplied `send` callback (one JSON-encoded event per call).
   */
  onMessage: (
    sessionId: string,
    raw: string,
    send: (encoded: string) => void,
  ) => Promise<void>;
};

export type MountedAgentWs = {
  close: () => Promise<void>;
};

/**
 * Minimal interface we need from the http server: register an `upgrade`
 * listener. Accepts both `node:http` Server and `@hono/node-server`'s union
 * `ServerType` (http/https/http2) without depending on either.
 */
export interface UpgradableServer {
  on(
    event: 'upgrade',
    listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
  ): unknown;
}

/**
 * Attach an HTTP `upgrade` handler on `server` that:
 *  - matches `/v1/widget/:sessionId/agent?token=...` (returns early for
 *    other paths so co-mounted ws servers can claim them)
 *  - verifies the JWT-equivalent token (sessionId must match the path)
 *  - forwards every inbound text frame to `deps.onMessage`, exposing a
 *    `send` callback that streams JSON-encoded AgentEvents back
 *
 * Errors thrown by `onMessage` are surfaced to the client as a
 * `session_closed` event with `reason: 'error'` followed by `ws.close()`.
 */
export function mountAgentWs(server: UpgradableServer, deps: AgentWsDeps): MountedAgentWs {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = url.pathname.match(/^\/v1\/widget\/([^/]+)\/agent$/);
    if (!m) return; // not our path; let other upgrade listeners handle
    const sessionId = decodeURIComponent(m[1] ?? '');
    const token = url.searchParams.get('token') ?? '';
    const payload = verifyWsToken(token);
    if (!payload || payload.sessionId !== sessionId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      ws.on('message', async (raw) => {
        const send = (encoded: string) => {
          if (ws.readyState === ws.OPEN) ws.send(encoded);
        };
        try {
          await deps.onMessage(sessionId, raw.toString(), send);
        } catch {
          send(JSON.stringify({ type: 'session_closed', reason: 'error' }));
          ws.close();
        }
      });
    });
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
        for (const ws of wss.clients) ws.terminate();
      }),
  };
}
