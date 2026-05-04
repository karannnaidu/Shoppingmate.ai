import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('/api/auth/[...all]', () => {
  it('exports GET and POST handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('GET returns Response from auth.handler', async () => {
    const req = new Request('http://localhost:3000/api/auth/session');
    const res = await GET(req);
    expect(res).toBeInstanceOf(Response);
  });
});
