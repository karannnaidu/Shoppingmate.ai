import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { encode } from 'gpt-tokenizer';
import { downloadKbObject } from '../r2-download.js';

export type IngestResult = { status: 'ready' | 'failed'; error?: string };

export async function ingestKbDoc(args: { documentId: string }): Promise<IngestResult> {
  const doc = await db.query.brandKbDocuments.findFirst({
    where: eq(schema.brandKbDocuments.id, args.documentId),
  });
  if (!doc) return { status: 'failed', error: 'document not found' };

  await db.update(schema.brandKbDocuments)
    .set({ status: 'processing' })
    .where(eq(schema.brandKbDocuments.id, args.documentId));

  try {
    const buf = await downloadKbObject(doc.storageUrl);
    const text = await extractText(buf, doc.mimeType);
    const chunks = chunkText(text, { targetTokens: 256, maxTokens: 512 });

    if (chunks.length > 0) {
      await db.insert(schema.brandKbChunks).values(
        chunks.map((c) => ({
          documentId: args.documentId,
          merchantId: doc.merchantId,
          chunkIndex: c.chunkIndex,
          text: c.text,
          tokenCount: c.tokenCount,
        })),
      );
    }

    await db.update(schema.brandKbDocuments)
      .set({ status: 'ready', readyAt: new Date() })
      .where(eq(schema.brandKbDocuments.id, args.documentId));

    await db.update(schema.merchants)
      .set({ knowledgeBaseStatus: 'ready' })
      .where(eq(schema.merchants.id, doc.merchantId));

    return { status: 'ready' };
  } catch (err) {
    const message = (err as Error).message;
    await db.update(schema.brandKbDocuments)
      .set({ status: 'failed', errorMessage: message })
      .where(eq(schema.brandKbDocuments.id, args.documentId));
    return { status: 'failed', error: message };
  }
}

async function extractText(buf: Buffer, mime: string): Promise<string> {
  if (mime === 'application/pdf') {
    // @ts-expect-error — pdf-parse types may not match dynamic import shape
    const { default: pdf } = await import('pdf-parse');
    const out = await pdf(buf);
    return out.text;
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { default: mammoth } = await import('mammoth');
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value;
  }
  return buf.toString('utf-8');
}

function chunkText(input: string, opts: { targetTokens: number; maxTokens: number }) {
  const sentences = input.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [input.trim()];
  const chunks: { chunkIndex: number; text: string; tokenCount: number }[] = [];
  let buf: string[] = [];
  let tokens = 0;
  const flush = () => {
    if (!buf.length) return;
    chunks.push({ chunkIndex: chunks.length, text: buf.join(' ').trim(), tokenCount: tokens });
    buf = [];
    tokens = 0;
  };
  for (const s of sentences) {
    const t = encode(s).length;
    if (tokens + t > opts.maxTokens && buf.length) flush();
    buf.push(s);
    tokens += t;
    if (tokens >= opts.targetTokens) flush();
  }
  flush();
  return chunks;
}
