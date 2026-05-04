import { describe, expect, it } from 'vitest';
import { presignKbUpload, presignKbDownload } from './r2';

describe('r2 wrapper', () => {
  it('presignKbUpload returns a URL with signature params', async () => {
    const url = await presignKbUpload({ key: 'm/SM-X/file.pdf', contentType: 'application/pdf' });
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('X-Amz-Signature');
  });

  it('presignKbDownload returns a URL', async () => {
    const url = await presignKbDownload({ key: 'm/SM-X/file.pdf' });
    expect(url).toMatch(/^https?:\/\//);
  });
});
