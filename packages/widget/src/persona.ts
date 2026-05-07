// Map a personaId (returned by /v1/voice/token) to display info — name +
// avatar URL. The avatar PNGs are produced by the ops/persona-portraits
// generator (fal.ai) and uploaded to a CDN. Until the file is present, the
// widget falls back to a styled monogram via initials/CSS.

export type PersonaDisplay = {
  id: string;
  name: string;
  initial: string;
  avatarUrl: string;
};

const NAMES: Record<string, string> = {
  'calm-clinician': 'Sage',
  stylist: 'Lumi',
  coach: 'Kai',
  concierge: 'Olivia',
  curator: 'Theo',
  guide: 'Maya',
  expert: 'Arjun',
  host: 'Ana',
};

const DEFAULT_ID = 'concierge';

function resolveCdnBase(): string {
  // Build-time replaced via esbuild `define`. Falls back to public CDN host.
  const override = (globalThis as unknown as { __SHOPPINGMATE_CDN_BASE__?: string })
    .__SHOPPINGMATE_CDN_BASE__;
  if (override && typeof override === 'string') return override.replace(/\/$/, '');
  return 'https://cdn.shoppingmate.ai/v1/personas';
}

export function getPersonaDisplay(personaId: string | null | undefined): PersonaDisplay {
  const id = personaId && NAMES[personaId] ? personaId : DEFAULT_ID;
  const name = NAMES[id] ?? 'Olivia';
  return {
    id,
    name,
    initial: name.charAt(0).toUpperCase(),
    avatarUrl: `${resolveCdnBase()}/${id}.png`,
  };
}
