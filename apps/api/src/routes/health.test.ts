import { describe, expect, it } from 'vitest';
import { healthRoute } from './health.js';

describe('GET /health', () => {
  it('returns { ok: true }', async () => {
    const res = await healthRoute.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
