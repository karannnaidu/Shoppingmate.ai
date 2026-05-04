import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyOpts {
  secret: string;
  webhookId: string | undefined;
  webhookTimestamp: string | undefined;
  webhookSignature: string | undefined;
  rawBody: string;
  toleranceSeconds?: number;
  now?: () => number;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyComposioSignature(opts: VerifyOpts): VerifyResult {
  const { secret, webhookId, webhookTimestamp, webhookSignature, rawBody } = opts;
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { ok: false, reason: 'missing headers' };
  }

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' };

  const now = (opts.now ?? Date.now)() / 1000;
  const tolerance = opts.toleranceSeconds ?? 300;
  if (Math.abs(now - ts) > tolerance) return { ok: false, reason: 'stale timestamp' };

  const expected = createHmac('sha256', secret)
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest('base64');

  const candidates = webhookSignature.split(' ').map((p) => p.replace(/^v1,/, ''));
  for (const cand of candidates) {
    const a = Buffer.from(expected);
    const b = Buffer.from(cand);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, reason: 'signature mismatch' };
}
