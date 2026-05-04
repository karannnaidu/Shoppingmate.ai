import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET ?? 'shoppingmate-kb';

if (!accessKeyId || !secretAccessKey || !accountId) {
  throw new Error('R2 credentials missing');
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

export async function presignKbUpload(args: { key: string; contentType: string; expiresIn?: number }): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: args.key, ContentType: args.contentType });
  return getSignedUrl(s3, command, { expiresIn: args.expiresIn ?? 600 });
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
