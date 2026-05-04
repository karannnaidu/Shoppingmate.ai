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
