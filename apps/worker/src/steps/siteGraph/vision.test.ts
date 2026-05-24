import { describe, expect, it, vi } from 'vitest';
import { needsGeneratedAlt, generateAltText } from './vision.js';

describe('needsGeneratedAlt', () => {
  it('returns false for decorative role', () => {
    expect(needsGeneratedAlt({ originalAlt: '', role: 'decorative' } as never)).toBe(false);
  });
  it('returns true for missing alt on hero/product', () => {
    expect(needsGeneratedAlt({ originalAlt: '', role: 'hero' } as never)).toBe(true);
    expect(needsGeneratedAlt({ originalAlt: null, role: 'product' } as never)).toBe(true);
  });
  it('returns true for too-short or generic alt', () => {
    expect(needsGeneratedAlt({ originalAlt: 'image', role: 'product' } as never)).toBe(true);
    expect(needsGeneratedAlt({ originalAlt: 'img', role: 'hero' } as never)).toBe(true);
  });
  it('returns false for substantive alt', () => {
    expect(needsGeneratedAlt({
      originalAlt: 'Golden retriever eating kibble from steel bowl',
      role: 'hero',
    } as never)).toBe(false);
  });
});

describe('generateAltText', () => {
  it('calls vision and returns description', async () => {
    const visionFn = vi.fn().mockResolvedValue('A red shoe on a white background.');
    const out = await generateAltText({ imageUrl: 'https://x.com/a.jpg', visionFn });
    expect(out).toBe('A red shoe on a white background.');
    expect(visionFn).toHaveBeenCalledWith('https://x.com/a.jpg');
  });

  it('returns null on vision failure', async () => {
    const visionFn = vi.fn().mockRejectedValue(new Error('vision down'));
    const out = await generateAltText({ imageUrl: 'https://x.com/a.jpg', visionFn });
    expect(out).toBeNull();
  });
});
