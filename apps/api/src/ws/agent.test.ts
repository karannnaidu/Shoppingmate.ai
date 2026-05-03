import { createServer } from 'node:http';
import { signWsToken } from '@shoppingmate/dom-harness';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { mountAgentWs } from './agent.js';

const server = createServer();
let port = 0;

beforeAll(async () => {
  mountAgentWs(server, {
    onMessage: async (_sessionId, _merchantId, raw, send) => {
      send(JSON.stringify({ type: 'say', text: `echo:${raw}` }));
      send(JSON.stringify({ type: 'end_of_turn' }));
    },
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  if (addr && typeof addr === 'object') port = addr.port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('mountAgentWs()', () => {
  it('rejects connection without a valid token', async () => {
    const url = `ws://localhost:${port}/v1/widget/s-1/agent`;
    const ws = new WebSocket(url);
    await new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
      ws.on('error', () => resolve());
    });
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('accepts a connection with a valid token and round-trips a message', async () => {
    const token = signWsToken({
      sessionId: 's-1',
      merchantId: 'm',
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const url = `ws://localhost:${port}/v1/widget/s-1/agent?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    ws.send('hello');
    const messages: string[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (raw) => {
        messages.push(raw.toString());
        if (messages.length === 2) resolve();
      });
    });
    expect(messages[0]).toContain('echo:hello');
    expect(JSON.parse(messages[1] as string)).toEqual({ type: 'end_of_turn' });
    ws.close();
  });
});
