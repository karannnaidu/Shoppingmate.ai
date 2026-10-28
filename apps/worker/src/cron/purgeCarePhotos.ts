import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { db, schema } from '@shoppingmate/db';
import { inArray, lt } from 'drizzle-orm';

// Customer Care PRD: shopper photo proof is kept for 180 days, then deleted
// from R2 and the database (privacy promise shown in the dashboard settings).

export const CARE_PHOTO_RETENTION_DAYS = 180;

let _s3: S3Client | null = null;
function s3(): S3Client {
  _s3 ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '' },
  });
  return _s3;
}

const deleteFromR2 = async (key: string): Promise<void> => {
  await s3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'shoppingmate-kb', Key: key }));
};

export async function purgeCarePhotos(opts: { now?: Date; deleteObject?: (key: string) => Promise<void> } = {}): Promise<{ deleted: number; failed: number }> {
  const cutoff = new Date((opts.now ?? new Date()).getTime() - CARE_PHOTO_RETENTION_DAYS * 86_400_000);
  const del = opts.deleteObject ?? deleteFromR2;
  let deleted = 0;
  let failed = 0;
  for (;;) {
    const batch = await db
      .select({ id: schema.caseAttachments.id, key: schema.caseAttachments.r2Key })
      .from(schema.caseAttachments)
      .where(lt(schema.caseAttachments.createdAt, cutoff))
      .limit(200);
    if (batch.length === 0) break;
    const done: number[] = [];
    for (const row of batch) {
      try {
        await del(row.key);
        done.push(row.id);
      } catch {
        failed += 1;
      }
    }
    if (done.length === 0) break; // R2 down: try again tomorrow instead of looping
    await db.delete(schema.caseAttachments).where(inArray(schema.caseAttachments.id, done));
    deleted += done.length;
  }
  return { deleted, failed };
}
