import { describe, expect, it } from 'vitest';
import { sniffImage } from './care.js';

describe('sniffImage', () => {
  it('recognises real image signatures', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]))).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(sniffImage(webp)).toBe('image/webp');
  });
  it('rejects anything else, whatever it claims to be', () => {
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBe(null);
    expect(sniffImage(new TextEncoder().encode('%PDF-1.7'))).toBe(null);
    expect(sniffImage(new Uint8Array([]))).toBe(null);
  });
});
