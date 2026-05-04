import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function downloadKbObject(key: string): Promise<Buffer> {
  const out = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'shoppingmate-kb', Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const c of out.Body as AsyncIterable<Uint8Array>) chunks.push(c);
  return Buffer.concat(chunks);
}
