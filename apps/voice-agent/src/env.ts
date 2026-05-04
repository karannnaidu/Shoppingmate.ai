import { z } from 'zod';

const Schema = z.object({
  LIVEKIT_URL: z
    .string()
    .url()
    .regex(/^wss?:\/\//, 'LIVEKIT_URL must be a wss:// URL'),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_LIVE_MODEL: z.string().min(1).default('gemini-2.5-flash-live'),
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
