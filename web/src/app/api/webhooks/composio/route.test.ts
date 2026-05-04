import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-TEST01' }) } },
  },
}));

vi.mock('@/lib/composio', () => ({
  composio: { connectedAccounts: { get: vi.fn().mockResolvedValue({ id: 'conn_x', metadata: { merchant_id: 'SM-TEST01' }, status: 'ACTIVE' }) } },
}));

import { POST } from './route';

const SECRET = 'whsec_composio_test';

function makeReq(body: object) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const id = 'msg_test_1';
  const sig = createHmac('sha256', SECRET).update(`${id}.${ts}.${raw}`).digest('base64');
  return new Request('http://localhost/api/webhooks/composio', {
    method: 'POST',
    headers: {
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': `v1,${sig}`,
      'content-type': 'application/json',
    },
    body: raw,
  });
}

describe('POST /api/webhooks/composio', () => {
  it('returns 200 on a valid connection.activated event', async () => {
    const req = makeReq({ type: 'connection.activated', data: { connection_id: 'conn_x', metadata: { merchant_id: 'SM-TEST01' } } });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 when signature missing', async () => {
    const req = new Request('http://localhost/api/webhooks/composio', { method: 'POST', body: '{}' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
