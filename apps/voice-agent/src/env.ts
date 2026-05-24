import { z } from 'zod';

const Schema = z.object({
  LIVEKIT_URL: z
    .string()
    .url()
    .regex(/^wss?:\/\//, 'LIVEKIT_URL must be a wss:// URL'),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // Verified via ListModels (v1beta, supportedGenerationMethods=bidiGenerateContent).
  // The 2.0/2.5 'flash-live' aliases shown in @google/genai's TS examples are
  // Vertex-only / not yet enabled on the GenAI API key path; the canonical
  // public-API name is the native-audio-* family. 'native-audio-latest'
  // auto-tracks the latest stable release without churning env vars.
  GEMINI_LIVE_MODEL: z.string().min(1).default('gemini-2.5-flash-native-audio-latest'),
});

export type VoiceEnv = z.infer<typeof Schema>;

export function parseVoiceEnv(
  raw: NodeJS.ProcessEnv | Record<string, string | undefined>,
): VoiceEnv {
  return Schema.parse(raw);
}

let cached: VoiceEnv | null = null;
export function voiceEnv(): VoiceEnv {
  if (!cached) cached = parseVoiceEnv(process.env);
  return cached;
}

export const DEMO_TOUR_ENABLED =
  (process.env.SHOPPINGMATE_DEMO_TOUR_ENABLED ?? 'false').toLowerCase() === 'true';
