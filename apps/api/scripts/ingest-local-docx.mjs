// Ingest a local .docx file into brand_kb_documents + brand_kb_chunks for a
// merchant. Mirrors apps/worker/src/jobs/ingestKbDoc.ts but skips R2 by
// reading the file from local disk. Use for one-off support-doc uploads
// before the dashboard upload UI ships.
//
// Usage (PowerShell):
//   $env:DATABASE_URL='postgresql://...'
//   node apps/api/scripts/ingest-local-docx.mjs SM-2SCCLZ "C:\path\to\file.docx"
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';
import mammoth from '../../../node_modules/.pnpm/mammoth@1.12.0/node_modules/mammoth/lib/index.js';
import { encode } from '../../../node_modules/.pnpm/gpt-tokenizer@2.9.0/node_modules/gpt-tokenizer/cjs/main.js';

const merchantId = process.argv[2];
const filePath = process.argv[3];
if (!merchantId || !filePath) {
  console.error('usage: node ingest-local-docx.mjs <merchantId> <path-to-docx>');
  process.exit(1);
}

const buf = await fs.readFile(filePath);
const sizeBytes = buf.length;
const filename = path.basename(filePath);
const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const { value: text } = await mammoth.extractRawText({ buffer: buf });
console.log('extracted text bytes:', text.length);
console.log('preview:', text.slice(0, 400).replace(/\s+/g, ' '));

function chunkText(input, { targetTokens = 256, maxTokens = 512 } = {}) {
  const sentences =
    input.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ??
    [input.trim()];
  const chunks = [];
  let buffer = [];
  let tokens = 0;
  const flush = () => {
    if (!buffer.length) return;
    chunks.push({ chunkIndex: chunks.length, text: buffer.join(' ').trim(), tokenCount: tokens });
    buffer = [];
    tokens = 0;
  };
  for (const s of sentences) {
    const t = encode(s).length;
    if (tokens + t > maxTokens && buffer.length) flush();
    buffer.push(s);
    tokens += t;
    if (tokens >= targetTokens) flush();
  }
  flush();
  return chunks;
}

const chunks = chunkText(text);
console.log('chunks:', chunks.length, 'total tokens:', chunks.reduce((a, c) => a + c.tokenCount, 0));

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const docId = randomUUID();
const storageUrl = `local://${filename}`;
await sql`
  INSERT INTO brand_kb_documents (id, merchant_id, filename, mime_type, size_bytes, storage_url, status, ready_at)
  VALUES (${docId}, ${merchantId}, ${filename}, ${mimeType}, ${sizeBytes}, ${storageUrl}, 'ready', now())
`;
console.log('inserted document:', docId);

if (chunks.length > 0) {
  for (const c of chunks) {
    await sql`
      INSERT INTO brand_kb_chunks (document_id, merchant_id, chunk_index, text, token_count)
      VALUES (${docId}, ${merchantId}, ${c.chunkIndex}, ${c.text}, ${c.tokenCount})
    `;
  }
  console.log('inserted chunks:', chunks.length);
}

await sql`UPDATE merchants SET knowledge_base_status='ready' WHERE id=${merchantId}`;
console.log('merchant knowledge_base_status set to ready');

await sql.end();
