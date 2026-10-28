import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadSession } from '@shoppingmate/agent';
import { caseEmail, db, latestSessionCase, ownerEmails, recordCaseEvent, schema, sendCareEmail } from '@shoppingmate/db';
import { childLogger, env } from '@shoppingmate/shared';
import { and, eq, gt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { Redis } from 'ioredis';
import { originMatches } from '../lib/originCheck.js';

// Customer Care PRD 2026-10-28: a shopper attaches photo proof (damaged item,
// wrong product) from the chat box or the voice-call panel. The widget resizes
// and re-encodes to JPEG first (which drops EXIF / location), then posts the
// bytes here. Stored privately in R2; owners view them from the dashboard.

const log = childLogger({ route: 'care' });

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_HOUR = 3;

/** JPEG / PNG / WebP by file signature (never trust the declared type). */
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP')
    return 'image/webp';
  return null;
}

let _redis: Redis | null = null;
const redis = () => (_redis ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }));
let _s3: S3Client | null = null;
function s3(): S3Client {
  if (_s3) return _s3;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error('R2 credentials missing');
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return _s3;
}

export const careRoute = new Hono();

// POST /v1/care/upload?sessionId=ws_…&merchantId=SM-…   body: the image bytes
careRoute.post('/upload', async (c) => {
  const sessionId = c.req.query('sessionId') ?? '';
  const merchantId = c.req.query('merchantId') ?? '';
  if (!/^ws_[a-z0-9]+$/.test(sessionId) || !/^SM-[A-Z0-9]{6}$/.test(merchantId)) {
    return c.json({ ok: false, error: 'invalid_request' }, 400);
  }
  const [merchant] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, merchantId)).limit(1);
  if (!merchant) return c.json({ ok: false, error: 'merchant_not_found' }, 404);
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  if (!merchant.allowedDomains.some((d: string) => originMatches(origin, referer, d))) {
    return c.json({ ok: false, error: 'origin_not_allowed' }, 403);
  }
  // A real conversation on this store (the widget always has one by now).
  const session = await loadSession(redis(), sessionId).catch(() => null);
  if (!session || session.merchantId !== merchantId) return c.json({ ok: false, error: 'unknown_session' }, 403);

  const len = Number(c.req.header('content-length') ?? 0);
  if (len > MAX_PHOTO_BYTES) return c.json({ ok: false, error: 'too_large', message: 'Photos must be under 10 MB.' }, 413);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    return c.json({ ok: false, error: 'too_large', message: 'Photos must be under 10 MB.' }, 413);
  }
  const mime = sniffImage(bytes);
  if (!mime) return c.json({ ok: false, error: 'not_an_image', message: 'Only photos (JPEG, PNG or WebP) can be attached.' }, 415);

  const since = new Date(Date.now() - 60 * 60_000);
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.caseAttachments)
    .where(and(eq(schema.caseAttachments.sessionId, sessionId), gt(schema.caseAttachments.createdAt, since)));
  if (n >= MAX_PHOTOS_PER_HOUR) {
    return c.json({ ok: false, error: 'too_many', message: `You can attach up to ${MAX_PHOTOS_PER_HOUR} photos.` }, 429);
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const key = `care/${merchantId}/${sessionId}/${randomUUID()}.${ext}`;
  await s3().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'shoppingmate-kb', Key: key, Body: bytes, ContentType: mime }),
  );
  // Already raised a request in this conversation? Attach straight to it.
  const existing = await latestSessionCase(merchantId, sessionId);
  const [row] = await db
    .insert(schema.caseAttachments)
    .values({ merchantId, sessionId, caseId: existing?.id ?? null, r2Key: key, mime, bytes: bytes.byteLength })
    .returning({ id: schema.caseAttachments.id });
  log.info({ merchantId, sessionId, bytes: bytes.byteLength, caseId: existing?.id ?? null }, 'care photo uploaded');

  if (existing) {
    void (async () => {
      await recordCaseEvent(existing.id, 'photos_added', '1 photo added by the customer', 'customer');
      const owners = await ownerEmails(merchantId);
      const [kase] = await db.select().from(schema.supportCases).where(eq(schema.supportCases.id, existing.id)).limit(1);
      if (owners.length === 0 || !kase) return;
      const brand = merchant.name ?? merchant.domain ?? 'your store';
      const { html } = caseEmail(kase, brand, { id: existing.id, photos: 1 });
      await sendCareEmail({
        from: process.env.RESEND_FROM ?? 'shoppingmate <onboarding@resend.dev>',
        to: owners,
        subject: `Photo added to request #${existing.id} (${brand})`,
        html,
      });
    })().catch((err) => log.warn({ err }, 'photo-added email failed'));
  }
  return c.json({ ok: true, id: row?.id, attachedTo: existing?.id ?? null });
});
