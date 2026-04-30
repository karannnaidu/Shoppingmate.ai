import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { safetyCheck } from '../../apps/worker/src/steps/safetyCheck.js';

const server = setupServer();
const ORIGINAL_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

beforeAll(() => {
  // Tests 1-3 exercise the live-API path; the env-loaded value is empty
  // by default in dev, so seed a fake key for the suite.
  process.env.GOOGLE_SAFE_BROWSING_API_KEY = 'test-api-key';
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  process.env.GOOGLE_SAFE_BROWSING_API_KEY = ORIGINAL_API_KEY ?? '';
});

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

describe('safetyCheck', () => {
  it('returns clean when API responds with no matches', async () => {
    server.use(http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})));
    const result = await safetyCheck('safe.test');
    expect(result).toEqual({ kind: 'clean' });
  });

  it('returns flagged when API returns matches', async () => {
    server.use(
      http.post(SAFE_BROWSING_URL, () =>
        HttpResponse.json({
          matches: [
            {
              threatType: 'MALWARE',
              platformType: 'ANY_PLATFORM',
              threat: { url: 'https://malware.test/' },
            },
          ],
        }),
      ),
    );
    const result = await safetyCheck('malware.test');
    expect(result).toEqual({ kind: 'flagged', threatType: 'MALWARE' });
  });

  it('throws after 3 transport failures (caller decides to BullMQ-retry)', async () => {
    let calls = 0;
    server.use(
      http.post(SAFE_BROWSING_URL, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    await expect(safetyCheck('flaky.test')).rejects.toThrow();
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('returns clean when API key is missing (degraded mode logged)', async () => {
    // Explicitly set env to empty for this test scope
    const original = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    process.env.GOOGLE_SAFE_BROWSING_API_KEY = '';
    try {
      const result = await safetyCheck('nokey.test');
      expect(result).toEqual({ kind: 'clean' });
    } finally {
      process.env.GOOGLE_SAFE_BROWSING_API_KEY = original ?? '';
    }
  });
});
