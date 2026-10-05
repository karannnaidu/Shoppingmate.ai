// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readBody, respond, wantsRedirect } from './billing-http';

describe('wantsRedirect', () => {
  it('true for a browser form navigation (Accept: text/html)', () => {
    expect(wantsRedirect(new Request('http://x', { headers: { accept: 'text/html,application/xhtml+xml' } }))).toBe(true);
  });
  it('false for fetch/JSON callers', () => {
    expect(wantsRedirect(new Request('http://x', { headers: { accept: 'application/json' } }))).toBe(false);
    expect(wantsRedirect(new Request('http://x', { headers: { accept: '*/*' } }))).toBe(false);
    expect(wantsRedirect(new Request('http://x'))).toBe(false);
  });
});

describe('readBody', () => {
  it('parses JSON bodies', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ topup_key: 'topup_200' }), headers: { 'content-type': 'application/json' } });
    expect(await readBody(req)).toEqual({ topup_key: 'topup_200' });
  });
  it('parses form-urlencoded bodies (native form submit)', async () => {
    const req = new Request('http://x', { method: 'POST', body: new URLSearchParams({ topup_key: 'topup_200' }) });
    expect(await readBody(req)).toEqual({ topup_key: 'topup_200' });
  });
  it('returns {} for an empty/unparseable body', async () => {
    expect(await readBody(new Request('http://x', { method: 'POST' }))).toEqual({});
  });
});

describe('respond', () => {
  it('303-redirects a browser form post to the target', () => {
    const req = new Request('http://x', { headers: { accept: 'text/html' } });
    const res = respond(req, { redirectTo: 'https://rzp.io/i/abc', json: { url: 'https://rzp.io/i/abc' } });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://rzp.io/i/abc');
  });
  it('returns JSON to a fetch caller', async () => {
    const req = new Request('http://x', { headers: { accept: '*/*' } });
    const res = respond(req, { redirectTo: 'https://rzp.io/i/abc', json: { url: 'https://rzp.io/i/abc' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://rzp.io/i/abc' });
  });
});
