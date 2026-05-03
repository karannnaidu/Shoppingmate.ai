import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { DomAck, DomAction, WSTransport } from '@shoppingmate/adapters';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifyWsToken } from './wsAuth.js';

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

type Pending = {
  resolve: (a: DomAck) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};

/** Per-process bridge: server-issued action → browser ws ack. */
class ServerTransport implements WSTransport {
  private sockets = new Map<string, WebSocket>();
  private pending = new Map<string, Pending>();

  attach(sessionId: string, ws: WebSocket): void {
    this.sockets.set(sessionId, ws);
    ws.on('close', () => {
      if (this.sockets.get(sessionId) === ws) this.sockets.delete(sessionId);
    });
    ws.on('message', (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (
        typeof msg !== 'object' ||
        msg === null ||
        (msg as { type?: unknown }).type !== 'ack'
      ) {
        return;
      }
      const m = msg as {
        type: 'ack';
        actionId?: unknown;
      } & Partial<DomAck>;
      const actionId = typeof m.actionId === 'string' ? m.actionId : undefined;
      if (!actionId) return;
      const pending = this.pending.get(actionId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(actionId);
      // Strip transport-level fields to leave just the DomAck shape.
      const { type: _t, actionId: _a, ...ack } = m;
      pending.resolve(ack as DomAck);
    });
  }

  async send(sessionId: string, action: DomAction): Promise<DomAck> {
    const ws = this.sockets.get(sessionId);
    if (!ws || ws.readyState !== ws.OPEN) {
      return { ok: false, reason: 'timeout' };
    }
    const actionId = randomUUID();
    return new Promise<DomAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(actionId);
        resolve({ ok: false, reason: 'timeout' });
      }, 5500);
      this.pending.set(actionId, { resolve, reject, timer });
      ws.send(JSON.stringify({ type: 'action', actionId, action }));
    });
  }
}

export type MountedWs = {
  transport: WSTransport;
  /** close all open sockets and the WSS — used by tests + adapter-smoke teardown. */
  close: () => Promise<void>;
};

/**
 * Attach an HTTP `upgrade` handler on `server` that:
 *  - matches `/v1/widget/:sessionId/ws?token=...`
 *  - verifies the JWT-equivalent token (sessionId must match the path)
 *  - hands the resulting WebSocket to the in-process `ServerTransport`
 *
 * Returns the transport so a co-located adapter (e.g. DOMAdapter) can call
 * `transport.send(sessionId, action)` and await the visitor's ack.
 */
export function mountWs(server: UpgradableServer): MountedWs {
  const wss = new WebSocketServer({ noServer: true });
  const transport = new ServerTransport();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = url.pathname.match(/^\/v1\/widget\/([^/]+)\/ws$/);
    if (!m) {
      socket.destroy();
      return;
    }
    const sessionId = decodeURIComponent(m[1] ?? '');
    const token = url.searchParams.get('token') ?? '';
    const payload = verifyWsToken(token);
    if (!payload || payload.sessionId !== sessionId) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => transport.attach(sessionId, ws));
  });

  return {
    transport,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => resolve());
        for (const ws of wss.clients) ws.terminate();
      }),
  };
}
