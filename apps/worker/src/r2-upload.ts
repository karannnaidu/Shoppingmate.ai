import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.R2_SITE_GRAPH_BUCKET ?? 'shoppingmate-site-graph';

const defaultClient = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

export async function uploadObject(
  key: string,
  body: Buffer | string,
  contentType: string,
  client: S3Client = defaultClient,
  bucket: string = BUCKET,
): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export function siteGraphKey(merchantId: string, crawlId: string, suffix: string): string {
  return `${merchantId}/${crawlId}/${suffix}`;
}
