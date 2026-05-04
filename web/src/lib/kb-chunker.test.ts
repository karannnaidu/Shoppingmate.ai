import { describe, expect, it } from 'vitest';
import { chunkText } from './kb-chunker';

describe('chunkText', () => {
  it('returns one chunk for short input', () => {
    const chunks = chunkText('Hello world. This is a test.', { targetTokens: 256, maxTokens: 512 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Hello world');
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into multiple chunks at sentence boundaries', () => {
    const sentence = 'This is a fairly long sentence that should help us reach the token limit. ';
    const text = sentence.repeat(200);
    const chunks = chunkText(text, { targetTokens: 256, maxTokens: 512 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.tokenCount).toBeLessThanOrEqual(512));
  });

  it('produces incrementing chunk_index', () => {
    const sentence = 'Quick brown fox jumps over the lazy dog. '.repeat(50);
    const chunks = chunkText(sentence, { targetTokens: 64, maxTokens: 128 });
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });
});
