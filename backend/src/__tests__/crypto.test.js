process.env.FIELD_ENCRYPTION_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f9001122334455667788990aabbccddeeff';
const { encryptField, decryptField, maskAadhaar } = require('../utils/crypto');

describe('field encryption', () => {
  it('encrypts and decrypts round-trip correctly', () => {
    const plaintext = '123456789012';
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it('returns null for empty input', () => {
    expect(encryptField('')).toBeNull();
    expect(encryptField(null)).toBeNull();
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptField('123456789012');
    const b = encryptField('123456789012');
    expect(a).not.toBe(b);
  });
});

describe('maskAadhaar', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskAadhaar('1234')).toBe('XXXX XXXX 1234');
  });
  it('handles missing value', () => {
    expect(maskAadhaar(null)).toBe('XXXX XXXX XXXX');
  });
});
