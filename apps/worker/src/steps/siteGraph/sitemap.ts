export function parseSitemap(xml: string): string[] {
  const matches = xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g);
  return Array.from(matches, (m) => m[1]).filter((u): u is string => Boolean(u));
}

export function filterUrls(urls: string[], hostname: string): string[] {
  const out: string[] = [];
  for (const u of urls) {
    let parsed: URL;
    try { parsed = new URL(u); } catch { continue; }
    if (parsed.hostname !== hostname && !parsed.hostname.endsWith(`.${hostname}`)) continue;
    const utm = Array.from(parsed.searchParams.keys()).some((k) => k.startsWith('utm_'));
    if (utm) continue;
    const page = parsed.searchParams.get('page');
    if (page && Number(page) > 3) continue;
    out.push(u);
  }
  return out;
}

export async function fetchSitemap(rootUrl: string, fetchFn: typeof fetch = fetch): Promise<string[]> {
  const root = new URL(rootUrl);
  const candidate = `${root.origin}/sitemap.xml`;
  try {
    const res = await fetchFn(candidate);
    if (!res.ok) return [];
    const xml = await res.text();
    return filterUrls(parseSitemap(xml), root.hostname);
  } catch {
    return [];
  }
}
