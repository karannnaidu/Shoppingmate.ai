export function validateDomain(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('domain is required');

  let value = trimmed.toLowerCase();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      throw new Error(`invalid domain: ${input}`);
    }
  }
  value = value.replace(/\/$/, '');

  if (value.includes('/')) {
    throw new Error(`domain must not contain a path: ${input}`);
  }
  if (!value.includes('.')) {
    throw new Error(`domain must contain a dot: ${input}`);
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    throw new Error(`domain contains invalid characters: ${input}`);
  }
  return value;
}
