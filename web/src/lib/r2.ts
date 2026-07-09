import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.R2_BUCKET ?? 'shoppingmate-kb';

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (_s3) return _s3;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 credentials missing');
  }
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _s3;
}

export const s3 = new Proxy({} as S3Client, {
  get(_target, prop) {
    const c = getS3();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

export async function presignKbUpload(args: { key: string; contentType: string; expiresIn?: number }): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: args.key, ContentType: args.contentType });
  return getSignedUrl(s3, command, { expiresIn: args.expiresIn ?? 600 });
}

// Server-side upload to R2. Used by the KB upload route so the browser never
// PUTs directly to the R2 domain (which would require a bucket CORS policy).
export async function putKbObject(args: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
    }),
  );
}

export async function presignKbDownload(args: { key: string; expiresIn?: number }): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: args.key });
  return getSignedUrl(s3, command, { expiresIn: args.expiresIn ?? 600 });
}

export async function downloadKbObject(key: string): Promise<Buffer> {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error('no body');
  const chunks: Uint8Array[] = [];
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export const R2_BUCKET = bucket;
