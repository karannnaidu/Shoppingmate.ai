import type { ExtractedMedia } from './extractStructured.js';

const GENERIC_ALTS = new Set(['image', 'img', 'photo', 'picture', 'banner', 'icon', '']);

export function needsGeneratedAlt(media: Pick<ExtractedMedia, 'originalAlt' | 'role'>): boolean {
  if (media.role === 'decorative' || media.role === 'icon' || media.role === 'background') return false;
  const alt = (media.originalAlt ?? '').trim().toLowerCase();
  if (alt.length < 10) return true;
  if (GENERIC_ALTS.has(alt)) return true;
  return false;
}

export type GenerateAltArgs = {
  imageUrl: string;
  visionFn: (url: string) => Promise<string>;
};

export async function generateAltText(args: GenerateAltArgs): Promise<string | null> {
  try {
    const out = await args.visionFn(args.imageUrl);
    return out.trim() || null;
  } catch {
    return null;
  }
}
