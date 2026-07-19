import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM authenticated encryption for secrets we store at rest (e.g. a
// merchant's Shopify Admin API access token). Key is a 32-byte value provided
// as 64 hex chars in SECRET_ENC_KEY. Ciphertext format: iv:authTag:data (hex).
function key(): Buffer {
  const hex = process.env.SECRET_ENC_KEY ?? '';
  if (hex.length !== 64) {
    throw new Error('SECRET_ENC_KEY must be a 32-byte value (64 hex chars)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${data.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
