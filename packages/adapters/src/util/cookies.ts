export function parseSetCookie(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  // Node 18+ Headers has getSetCookie(); fall back for older runtimes.
  const maybe = headers as unknown as { getSetCookie?: () => string[] };
  const setCookies: string[] =
    typeof maybe.getSetCookie === 'function'
      ? maybe.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie') as string]
        : [];
  for (const sc of setCookies) {
    const first = sc.split(';')[0] ?? '';
    const eq = first.indexOf('=');
    if (eq > 0) jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

export function formatCookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
