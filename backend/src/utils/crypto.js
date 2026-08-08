const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 32-byte (64 hex char) value');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext string (e.g. Aadhaar number) for storage.
 * Output format: iv:authTag:ciphertext (all base64), so it round-trips safely.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptField(stored) {
  if (!stored) return null;
  const [ivB64, tagB64, dataB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Returns e.g. "XXXX XXXX 1234" from a 12-digit Aadhaar number. */
function maskAadhaar(last4) {
  if (!last4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${last4}`;
}

module.exports = { encryptField, decryptField, maskAadhaar };
