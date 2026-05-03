import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type MountedWs, mountWs, signWsToken, verifyWsToken } from '@shoppingmate/dom-harness';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

let server: Server;
let mounted: MountedWs;
let port = 0;

beforeAll(async () => {
  server = createServer();
  mounted = mountWs(server);
  await new Promise<void>((res) => {
    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      res();
    });
  });
});

afterAll(async () => {
  await mounted.close();
  await new Promise<void>((res) => server.close(() => res()));
});

describe('widget WebSocket auth', () => {
  it('verifyWsToken accepts a freshly signed token', () => {
    const token = signWsToken({
      sessionId: 's-x',
      merchantId: 'SM-T01',
      exp: Date.now() / 1000 + 60,
    });
    const payload = verifyWsToken(token);
    expect(payload?.sessionId).toBe('s-x');
    expect(payload?.merchantId).toBe('SM-T01');
  });

  it('verifyWsToken rejects expired tokens', () => {
    const token = signWsToken({
      sessionId: 's-x',
      merchantId: 'SM-T01',
      exp: Date.now() / 1000 - 5,
    });
    expect(verifyWsToken(token)).toBeNull();
  });

  it('verifyWsToken rejects tampered signature', () => {
    const token = signWsToken({
      sessionId: 's-x',
      merchantId: 'SM-T01',
      exp: Date.now() / 1000 + 60,
    });
    const [body] = token.split('.');
    expect(verifyWsToken(`${body}.AAAA`)).toBeNull();
  });
});

describe('widget WebSocket round-trip', () => {
  it('sends action server→client, awaits ack, resolves promise', async () => {
    const token = signWsToken({
      sessionId: 's1',
      merchantId: 'SM-T01',
      exp: Date.now() / 1000 + 60,
    });
    const client = new WebSocket(`ws://localhost:${port}/v1/widget/s1/ws?token=${token}`);
    await new Promise<void>((res, rej) => {
      client.on('open', () => res());
      client.on('error', rej);
    });

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string; actionId?: string };
      if (msg.type === 'action' && msg.actionId) {
        client.send(
          JSON.stringify({
            type: 'ack',
            actionId: msg.actionId,
            ok: true,
            value: 'pong',
          }),
        );
      }
    });

    const ack = await mounted.transport.send('s1', {
      type: 'dom.read',
      selector: '.x',
    });
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.value).toBe('pong');
    client.close();
    // wait briefly for close so the server-side socket is released before next test
    await new Promise<void>((res) => {
      client.on('close', () => res());
      setTimeout(res, 200);
    });
  });

  it('rejects upgrade when token is invalid', async () => {
    const client = new WebSocket(`ws://localhost:${port}/v1/widget/s2/ws?token=garbage`);
    const result = await new Promise<'open' | 'error'>((res) => {
      client.on('open', () => res('open'));
      client.on('error', () => res('error'));
      client.on('close', () => res('error'));
    });
    expect(result).toBe('error');
  });

  it('returns ok:false reason=timeout when no socket attached for sessionId', async () => {
    const ack = await mounted.transport.send('does-not-exist', {
      type: 'dom.read',
      selector: '.x',
    });
    expect(ack.ok).toBe(false);
    if (!ack.ok) expect(ack.reason).toBe('timeout');
  });
});
