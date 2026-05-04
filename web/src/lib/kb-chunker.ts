import { encode } from 'gpt-tokenizer';

export type Chunk = { chunkIndex: number; text: string; tokenCount: number };

export function chunkText(input: string, opts: { targetTokens: number; maxTokens: number }): Chunk[] {
  const sentences = splitSentences(input);
  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(' ').trim();
    chunks.push({ chunkIndex: chunks.length, text, tokenCount: bufferTokens });
    buffer = [];
    bufferTokens = 0;
  };

  for (const sentence of sentences) {
    const sentenceTokens = encode(sentence).length;
    if (bufferTokens + sentenceTokens > opts.maxTokens && buffer.length > 0) {
      flush();
    }
    buffer.push(sentence);
    bufferTokens += sentenceTokens;
    if (bufferTokens >= opts.targetTokens) flush();
  }
  flush();
  return chunks;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [text.trim()];
}
