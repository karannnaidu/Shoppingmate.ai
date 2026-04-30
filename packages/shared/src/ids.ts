import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const suffix = customAlphabet(alphabet, 6);

export function generateMerchantId(): string {
  return `SM-${suffix()}`;
}
