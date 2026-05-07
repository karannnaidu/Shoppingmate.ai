import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fal } from '@fal-ai/client';

const PERSONA_IDS = [
  'calm-clinician',
  'stylist',
  'coach',
  'concierge',
  'curator',
  'guide',
  'expert',
  'host',
] as const;

const MODEL = 'fal-ai/flux/dev';
const OUT_DIR = resolve(import.meta.dirname, '../../packages/widget/public/personas');
const FORCE = process.argv.includes('--force');

type FluxResult = {
  data?: { images?: { url: string }[] };
  images?: { url: string }[];
};

const PROMPTS: Record<string, string> = {
  'calm-clinician':
    'Photorealistic close-up portrait of a calm, professional woman in her early thirties with warm brown skin, dark hair pulled back, clear focused eyes, subtle smile, wearing a clean white blouse. Soft studio lighting, neutral grey background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a trusted clinician or wellness guide.',
  stylist:
    'Photorealistic close-up portrait of a fashion-forward woman in her late twenties, light brown hair with subtle highlights, expressive hazel eyes, confident warm smile, wearing a stylish neutral cashmere sweater. Soft warm studio lighting, off-white background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a tasteful boutique stylist.',
  coach:
    'Photorealistic close-up portrait of an athletic, energetic man in his early thirties, short dark hair, defined jawline, friendly direct eyes, slight confident smile, wearing a fitted athletic black t-shirt. Crisp studio lighting, dark charcoal background. Shallow depth of field, 85mm lens, natural skin texture. Looks like an approachable performance coach.',
  concierge:
    'Photorealistic close-up portrait of an elegant woman in her mid thirties, sleek dark hair in a low chignon, refined features, warm intelligent eyes, subtle composed smile, wearing a tailored charcoal blazer. Sophisticated studio lighting, deep blue-grey background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a private boutique concierge.',
  curator:
    'Photorealistic close-up portrait of a thoughtful man in his late thirties, neatly trimmed beard, warm olive skin, kind observant eyes, wearing a soft earthy linen shirt. Warm natural window light, beige textured background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a craftsman or shop curator with a story to tell.',
  guide:
    'Photorealistic close-up portrait of a friendly woman in her late twenties, shoulder-length dark hair, light brown skin, bright curious eyes, open inviting smile, wearing a casual deep teal henley. Bright clean studio lighting, soft white background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a knowledgeable peer who explains things clearly.',
  expert:
    'Photorealistic close-up portrait of a confident man in his late thirties, South Asian features, short black hair, well-trimmed beard, intelligent focused eyes, slight precise smile, wearing a slate grey collared shirt. Crisp studio lighting, neutral graphite background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a deeply technical subject-matter expert.',
  host:
    'Photorealistic close-up portrait of a warm welcoming woman in her early thirties, wavy auburn hair, freckled fair skin, bright smiling green eyes, genuine open laugh, wearing a soft cream knit. Golden hour natural lighting, warm cream background. Shallow depth of field, 85mm lens, natural skin texture. Looks like a generous host who anticipates your needs.',
};

async function ensureKey(): Promise<void> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not set');
  fal.config({ credentials: key });
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function generateOne(personaId: string, prompt: string): Promise<void> {
  const dest = resolve(OUT_DIR, `${personaId}.png`);
  if (!FORCE && existsSync(dest)) {
    console.log(`[skip] ${personaId} — exists at ${dest}`);
    return;
  }
  console.log(`[gen]  ${personaId} — calling ${MODEL}…`);
  const result = (await fal.subscribe(MODEL, {
    input: {
      prompt,
      image_size: 'square_hd',
      num_images: 1,
      num_inference_steps: 32,
      guidance_scale: 3.5,
      enable_safety_checker: true,
    },
    logs: false,
  })) as FluxResult;
  const images = result.data?.images ?? result.images;
  const url = images?.[0]?.url;
  if (!url) throw new Error(`${personaId}: no image url in response — ${JSON.stringify(result).slice(0, 200)}`);
  await downloadToFile(url, dest);
  console.log(`[ok]   ${personaId} -> ${dest}`);
}

async function main(): Promise<void> {
  await ensureKey();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  for (const id of PERSONA_IDS) {
    const prompt = PROMPTS[id];
    if (!prompt) {
      console.warn(`[warn] no prompt for ${id} — skipping`);
      continue;
    }
    try {
      await generateOne(id, prompt);
    } catch (err) {
      console.error(`[err]  ${id} —`, err instanceof Error ? err.message : err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
