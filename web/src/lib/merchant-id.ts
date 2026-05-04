const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
export function generateMerchantId(): string {
  let id = 'SM-';
  for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
}
