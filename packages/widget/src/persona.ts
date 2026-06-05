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
  'calmosis-clinician': 'Calmio',
  stylist: 'Lumi',
  coach: 'Kai',
  concierge: 'Olivia',
  curator: 'Theo',
  guide: 'Maya',
  expert: 'Arjun',
  host: 'Ana',
};

// Persona ids whose CDN portrait should reuse another persona's image
// (e.g. brand-scoped variants that share the underlying clinical look).
const PORTRAIT_ALIASES: Record<string, string> = {
  'calmosis-clinician': 'calm-clinician',
};

function resolveCdnBase(): string {
  // Build-time replaced via esbuild `define`. Falls back to public CDN host.
  const override = (globalThis as unknown as { __SHOPPINGMATE_CDN_BASE__?: string })
    .__SHOPPINGMATE_CDN_BASE__;
  if (override && typeof override === 'string') return override.replace(/\/$/, '');
  return 'https://cdn.shoppingmate.ai/v1/personas';
}

// Neutral placeholder used until bootstrap resolves the merchant's actual
// persona. Picking a specific persona (e.g. 'concierge'/Olivia) caused a
// visible flash of the wrong name on sites whose merchant uses a different
// persona, with click handlers wired up before the WS was open.
const PLACEHOLDER: PersonaDisplay = {
  id: 'pending',
  name: 'Assistant',
  initial: 'A',
  avatarUrl: '',
};

export function getPersonaPlaceholder(): PersonaDisplay {
  return PLACEHOLDER;
}

export function getPersonaDisplay(personaId: string | null | undefined): PersonaDisplay {
  if (!personaId || !NAMES[personaId]) return PLACEHOLDER;
  const name = NAMES[personaId];
  const portraitId = PORTRAIT_ALIASES[personaId] ?? personaId;
  return {
    id: personaId,
    name,
    initial: name.charAt(0).toUpperCase(),
    avatarUrl: `${resolveCdnBase()}/${portraitId}.png`,
  };
}
