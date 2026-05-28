export const VISITOR_ID_KEY = 'sm_visitor_id';
export const VISITOR_ID_TTL_MS = 7 * 24 * 3600 * 1000;

type Stored = { id: string; expiresAt: number };

function generate(): string {
  // 16 hex chars of crypto random
  const buf = new Uint8Array(8);
  (globalThis.crypto ?? window.crypto).getRandomValues(buf);
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `v_${hex}`;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(VISITOR_ID_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.id && typeof parsed.expiresAt === 'number') return parsed;
    }
  } catch {
    /* fall through to cookie */
  }
  // Cookie fallback when localStorage is denied/cleared (Safari ITP, quota, private mode)
  const match = document.cookie.match(new RegExp(`(?:^|; )${VISITOR_ID_KEY}=([^;]+)`));
  if (match) {
    return { id: decodeURIComponent(match[1]), expiresAt: Date.now() + 1 };
  }
  return null;
}

function writeStored(s: Stored): void {
  try {
    localStorage.setItem(VISITOR_ID_KEY, JSON.stringify(s));
    // Cookie fallback for cross-subdomain Shopify checkouts
    const maxAgeSec = Math.floor(VISITOR_ID_TTL_MS / 1000);
    document.cookie = `${VISITOR_ID_KEY}=${s.id}; max-age=${maxAgeSec}; path=/; SameSite=Lax; Secure`;
  } catch {
    /* swallow — private mode etc. */
  }
}

export function getOrCreateVisitorId(): string {
  const now = Date.now();
  const stored = readStored();
  if (stored && stored.expiresAt > now) {
    writeStored({ id: stored.id, expiresAt: now + VISITOR_ID_TTL_MS });
    return stored.id;
  }
  const id = generate();
  writeStored({ id, expiresAt: now + VISITOR_ID_TTL_MS });
  return id;
}
