const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex)
 */
function encrypt(text) {
  if (!text) return '';
  if (KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string produced by encrypt().
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  // Support plain-text values stored before encryption was added
  if (!encryptedText.includes(':')) return encryptedText;
  try {
    const [ivHex, authTagHex, cipherText] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails (e.g. old plain value), return as-is
    return encryptedText;
  }
}

module.exports = { encrypt, decrypt };
