export function originMatches(
  origin: string | undefined,
  referer: string | undefined,
  expectedDomain: string,
): boolean {
  const host = extractHost(origin) ?? extractHost(referer);
  return host !== null && host === expectedDomain;
}

function extractHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
